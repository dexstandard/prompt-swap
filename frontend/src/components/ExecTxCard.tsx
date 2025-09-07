import type { LimitOrder } from '../lib/types';

interface Props {
  orders: LimitOrder[];
}

export default function ExecTxCard({ orders }: Props) {
  return (
    <div className="mt-2 rounded border p-2 text-sm">
      <div className="font-bold mb-1">Limit order(s)</div>
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            <th className="pr-2">Side</th>
            <th className="pr-2">Qty</th>
            <th className="pr-2">Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={i}>
              <td className="pr-2">{o.side}</td>
              <td className="pr-2">{o.quantity}</td>
              <td className="pr-2">{o.price}</td>
              <td>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
