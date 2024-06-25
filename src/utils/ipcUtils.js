async function handleIpcMainEvent(event, handler) {
  try {
    return await handler(event);
  } catch (error) {
    console.error(`Error in ${event}:`, error);
    throw new Error(`Failed to handle ${JSON.stringify(event)}.`);
  }
}

module.exports = { handleIpcMainEvent };
