const shipmentStatus = {
  BOOKED: 'BOOKED',
  PICKED: 'PICKED',
  IN_WAREHOUSE: 'IN_WAREHOUSE',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETURNED: 'RETURNED'
};

const validTransitions = {
  [shipmentStatus.BOOKED]: [shipmentStatus.PICKED, shipmentStatus.IN_WAREHOUSE],
  [shipmentStatus.PICKED]: [shipmentStatus.IN_WAREHOUSE],
  [shipmentStatus.IN_WAREHOUSE]: [shipmentStatus.IN_TRANSIT, shipmentStatus.OUT_FOR_DELIVERY],
  [shipmentStatus.IN_TRANSIT]: [shipmentStatus.IN_WAREHOUSE],
  [shipmentStatus.OUT_FOR_DELIVERY]: [shipmentStatus.DELIVERED, shipmentStatus.FAILED, shipmentStatus.RETURNED],
  [shipmentStatus.FAILED]: [shipmentStatus.IN_WAREHOUSE, shipmentStatus.OUT_FOR_DELIVERY],
  [shipmentStatus.RETURNED]: [shipmentStatus.IN_WAREHOUSE],
  [shipmentStatus.DELIVERED]: [] // Final state
};

/**
 * Validates if a status transition is allowed.
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
const isValidTransition = (currentStatus, nextStatus) => {
  if (!validTransitions[currentStatus]) return false;
  return validTransitions[currentStatus].includes(nextStatus);
};

module.exports = {
  shipmentStatus,
  isValidTransition
};
