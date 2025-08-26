import { useEffect, useState } from 'react';
import Button from './Button';
import Modal from './Modal';

interface Props {
  open: boolean;
  message: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function PromptDialog({ open, message, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue('');
  }, [open]);
  return (
    <Modal open={open} onClose={onCancel}>
      <p className="mb-2">{message}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border p-2 w-full mb-4"
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(value)}>Submit</Button>
      </div>
    </Modal>
  );
}
