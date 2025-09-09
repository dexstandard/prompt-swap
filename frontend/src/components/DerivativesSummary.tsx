import { useEffect, useState } from 'react';

interface Props {
  symbol: string;
}

export default function DerivativesSummary({ symbol }: Props) {
  const [data, setData] = useState<{
    openInterest: number;
    fundingRate: number;
    bid: number;
    ask: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [oiRes, frRes, obRes] = await Promise.all([
          fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
          fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`),
          fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=5`),
        ]);
        const [oiJson, frJson, obJson] = await Promise.all([
          oiRes.json(),
          frRes.json(),
          obRes.json(),
        ]);
        const fr = Array.isArray(frJson) ? frJson[0] : frJson;
        const bid = obJson.bids?.[0]?.[0];
        const ask = obJson.asks?.[0]?.[0];
        setData({
          openInterest: Number(oiJson.openInterest),
          fundingRate: Number(fr?.fundingRate ?? 0),
          bid: Number(bid),
          ask: Number(ask),
        });
      } catch {
        setData(null);
      }
    }
    load();
  }, [symbol]);

  if (!data) return null;
  return (
    <div className="mt-2 text-sm">
      <p>Open Interest: {data.openInterest.toFixed(2)}</p>
      <p>Funding Rate: {data.fundingRate.toFixed(4)}</p>
      <p>
        Bid: {data.bid} / Ask: {data.ask}
      </p>
    </div>
  );
}
