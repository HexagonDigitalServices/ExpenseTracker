const getDateRange = (range) => {
  const now = new Date();
  let start;

  switch (range) {
    case "daily":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "weekly":
      const firstDayOfWeek = now.getDate() - now.getDay();
      start = new Date(now.setDate(firstDayOfWeek));
      break;
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "yearly":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1); // default monthly
  }

  return { start, end: new Date() };
};

export default getDateRange