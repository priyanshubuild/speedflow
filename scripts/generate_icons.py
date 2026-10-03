"""Render the simple SpeedFlow mark as antialiased PNGs using the Python standard library."""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent
SEGMENTS = ((35, 42, 58, 64), (58, 64, 35, 86), (70, 42, 93, 64), (93, 64, 70, 86))
def distance(x, y, segment):
    ax, ay, bx, by = segment
    t = max(0, min(1, ((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)))
    return math.hypot(x-ax-t*(bx-ax), y-ay-t*(by-ay))
def sample(x, y):
    # Rounded rectangle, equivalent to the checked-in SVG's red base.
    dx, dy = max(abs(x-64)-32, 0), max(abs(y-64)-32, 0)
    if math.hypot(dx, dy) > 28:
        return 0, 0, 0, 0
    if any(distance(x, y, segment) <= 5 for segment in SEGMENTS):
        return 255, 255, 255, 255
    return 255, 0, 51, 255

def chunk(name, data):
    return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name+data) & 0xffffffff)
def render(size):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            pixels = [sample((x+(sx+.5)/4)*128/size, (y+(sy+.5)/4)*128/size) for sy in range(4) for sx in range(4)]
            alpha_sum = sum(p[3] for p in pixels)
            rgb = [round(sum(p[c]*p[3] for p in pixels)/alpha_sum) if alpha_sum else 0 for c in range(3)]
            rows.extend((*rgb, round(alpha_sum/16)))
    header = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', header)+chunk(b'IDAT', zlib.compress(rows, 9))+chunk(b'IEND', b'')
if __name__ == '__main__':
    for size in (16, 32, 48, 128):
        path = ROOT / 'icons' / f'icon-{size}.png'
        path.write_bytes(render(size))
        print(path.name)
