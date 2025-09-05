import { useState, useEffect } from 'react';
import { AlertCircle, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import type { LimitOrder } from '../lib/types';
import Modal from './ui/Modal';
import TextInput from './forms/TextInput';
import ExecSuccessItem from './ExecSuccessItem';
import ExecTxCard from './ExecTxCard';
import Button from './ui/Button';

const MAX_LEN = 255;
function truncate(text: string) {
  return text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '…' : text;
}

function isErrorWithMessage(
  err: Record<string, unknown>
): err is { message: string } {
  return typeof (err as { message?: unknown }).message === 'string';
}

export interface ExecLog {
  id: string;
  log: string;
  response?: {
    rebalance: boolean;
    newAllocation?: number;
    shortReport: string;
  };
  error?: Record<string, unknown>;
  createdAt: number;
}

interface Props {
  log: ExecLog;
  agentId: string;
  manualRebalance: boolean;
  tokens: string[];
}

export default function ExecLogItem({ log, agentId, manualRebalance, tokens }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const { log: text, error, response } = log;
  const hasError = error && Object.keys(error).length > 0;
  const hasResponse = response && Object.keys(response).length > 0;
  const {
    data: orders,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['exec-orders', agentId, log.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${agentId}/exec-log/${log.id}/orders`);
      return res.data.orders as LimitOrder[];
    },
    enabled: showTx || (!!response?.rebalance && manualRebalance),
  });
  const hasOrders = !!orders && orders.length > 0;
  const txEnabled = !!response?.rebalance && (!manualRebalance || hasOrders);
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [order, setOrder] = useState<{ quantity: number; price: number; side: string } | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (showPreview && order) {
      setQuantity(order.quantity.toString());
      setPrice(order.price.toString());
    }
  }, [showPreview, order]);

  async function handleRebalance() {
    setCreating(true);
    try {
      const res = await api.get(`/agents/${agentId}/exec-log/${log.id}/rebalance/preview`);
      const ord = res.data.order as { quantity: number; price: number; side: string };
      setOrder(ord);
      setManuallyEdited(false);
      setShowPreview(true);
    } catch {
      setErrorMsg('Failed to fetch order preview');
    } finally {
      setCreating(false);
    }
  }

  async function confirmRebalance() {
    setCreating(true);
    try {
      await api.post(`/agents/${agentId}/exec-log/${log.id}/rebalance`, {
        quantity: Number(quantity),
        price: Number(price),
        ...(manuallyEdited ? { manuallyEdited: true } : {}),
      });
      setShowPreview(false);
      await refetchOrders();
    } catch (err: unknown) {
      type ErrResp = {
        response?: { data?: { error?: unknown } };
        message?: string;
      };
      const e = err as ErrResp;
      const errData = e.response?.data?.error;
      const msg =
        typeof errData === 'string'
          ? errData
          : (errData as { message?: string } | undefined)?.message ||
            (isErrorWithMessage(e as Record<string, unknown>)
              ? e.message!
              : 'failed to create order');
      setErrorMsg(msg);
    } finally {
      setCreating(false);
    }
  }
  return (
    <div className="w-full">
      <div className="flex items-start">
        <div className="flex-1">
          {!hasError && !hasResponse && text && (
            <div className="whitespace-pre-wrap break-words">{truncate(text)}</div>
          )}
          {hasError && (
            <div className="mt-1 flex items-center gap-2 rounded border border-red-300 bg-red-50 p-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <div className="flex-1 break-words">
                <span className="font-bold mr-1">ERROR</span>
                <span>
                  {truncate(
                    isErrorWithMessage(error as Record<string, unknown>)
                      ? (error as { message: string }).message
                      : JSON.stringify(error),
                  )}
                </span>
              </div>
              <Eye
                className="h-4 w-4 cursor-pointer"
                onClick={() => setShowJson(true)}
              />
              <Modal open={showJson} onClose={() => setShowJson(false)}>
                <pre className="whitespace-pre-wrap text-sm">
                  {JSON.stringify(error, null, 2)}
                </pre>
              </Modal>
            </div>
          )}
          {hasResponse && <ExecSuccessItem response={response} />}
        </div>
        {manualRebalance && !!response?.rebalance && !hasOrders && (
          <Button
            variant="secondary"
            className="ml-2 self-center"
            onClick={handleRebalance}
            loading={creating}
          >
            Rebalance
          </Button>
        )}
        {txEnabled && (
          <div
            className="ml-2 flex cursor-pointer items-center gap-1 text-xs text-blue-600"
            onClick={() => setShowTx((s) => !s)}
          >
            <span className="rounded border border-blue-600 px-1">Tx</span>
            {showTx ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </div>
        )}
      </div>
      {showTx && orders && <ExecTxCard orders={orders} />}
      {showPreview && order && (
        <Modal open={showPreview} onClose={() => setShowPreview(false)}>
          <h3 className="mb-2 text-lg font-bold">Confirm Rebalance</h3>
          <div className="mb-2 text-sm">
            Side: {order.side}
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-sm">Quantity ({tokens[0]})</label>
            <TextInput
              type="number"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setManuallyEdited(true);
              }}
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm">Price ({tokens[1]})</label>
            <TextInput
              type="number"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setManuallyEdited(true);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRebalance} loading={creating}>
              Confirm
            </Button>
          </div>
        </Modal>
      )}
      {errorMsg && (
        <Modal open onClose={() => setErrorMsg(null)}>
          <p className="mb-4">{errorMsg}</p>
          <div className="flex justify-end">
            <Button onClick={() => setErrorMsg(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
