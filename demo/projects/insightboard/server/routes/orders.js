import { Router } from './router.js';
import { listOrders, getOrder, revenueTotals } from '../services/orderService.js';
import { toGatewayCharge } from '../services/billingClient.js';

export const ordersRouter = new Router();

ordersRouter.get('/api/orders', (req, res) => {
  res.json(200, { orders: listOrders() });
});

ordersRouter.get('/api/orders/:id', (req, res) => {
  const order = getOrder(Number(req.params.id));
  if (!order) {
    res.json(404, { error: 'order_not_found' });
    return;
  }
  res.json(200, { order });
});

ordersRouter.get('/api/orders/:id/gateway-payload', (req, res) => {
  const order = getOrder(Number(req.params.id));
  if (!order) {
    res.json(404, { error: 'order_not_found' });
    return;
  }
  res.json(200, { payload: toGatewayCharge(order) });
});

ordersRouter.get('/api/revenue', (req, res) => {
  res.json(200, { totals: revenueTotals() });
});
