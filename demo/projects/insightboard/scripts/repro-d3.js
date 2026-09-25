/**
 * Reproduction for the reported "GET /api/orders returns 500" bug.
 * Calls the same service the route handler calls.
 */
import { listOrders, revenueTotals } from '../server/services/orderService.js';

console.log('GET /api/orders');
try {
  const orders = listOrders();
  console.log('response body:', JSON.stringify({ orders }, null, 2));
  console.log('totals:', JSON.stringify(revenueTotals()));
  console.log('\nNOT REPRODUCED: /api/orders served successfully');
} catch (err) {
  console.error('\nREPRODUCED: route handler threw');
  console.error(`${err.name}: ${err.message}`);
  process.exit(1);
}
