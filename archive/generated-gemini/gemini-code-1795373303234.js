await saveSystemUnifiedDataSafe((current) => {
  const base = current || {};
  return {
    ...base,
    counter: (base.counter || 0) + 1
  };
}, { mode: "transaction", subPath: "counters" });