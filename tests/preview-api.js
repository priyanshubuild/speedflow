/* Test fixture only. Never included in extension packages. */
(() => {
  const handlers = [], values = { sfSpeed: 1 };
  window.browser = {
    runtime: { id: 'speedflow-preview', onMessage: { addListener() {} } },
    storage: {
      onChanged: { addListener(handler) { handlers.push(handler); } },
      local: {
        async get() { return { ...values }; },
        async set(patch) {
          const changes = {};
          for (const [key, value] of Object.entries(patch)) if(values[key] !== value) {
            changes[key] = { oldValue: values[key], newValue: value }; values[key] = value;
          }
          handlers.forEach(handler => handler(changes, 'local'));
        },
      },
    },
  };
})();
