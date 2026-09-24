import { X, ArrowUpRight, Check, Circle, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import {
  useEffect,
  useRef,
  useId,
  useState,
  cloneElement,
  isValidElement,
  Children,
  type ReactElement,
} from 'react';
export function Brand() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function closeAbout() {
    setAboutOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }
  return (
    <div className="brand">
      <span className="brand-icon">
        <Image
          src="/icons/brand-mark-64.png"
          alt=""
          width={35}
          height={35}
          unoptimized
        />
      </span>
      <span className="brand-copy">
        <span className="brand-name">
          Shabooya<span className="brand-dot">.</span>
        </span>
        <button
          ref={triggerRef}
          type="button"
          className="brand-subtitle"
          aria-haspopup="dialog"
          onClick={() => setAboutOpen(true)}
        >
          Roll call
        </button>
      </span>
      {aboutOpen && (
        <Modal title="Why Shabooya?" onClose={closeAbout} compact>
          <p>A little nod to “Shabooya Roll Call.”</p>
          <p>Roll call, but smarter.</p>
        </Modal>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  name = 'password',
  autoComplete,
  placeholder,
  showRequirements = false,
}: {
  label: string;
  name?: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  showRequirements?: boolean;
}) {
  const id = useId();
  const requirementsId = useId();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const meetsMinimum = value.length >= 10;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={showRequirements ? 10 : 1}
          required
          placeholder={placeholder}
          value={value}
          aria-describedby={showRequirements ? requirementsId : undefined}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
      {showRequirements && (
        <div className="password-requirements" id={requirementsId}>
          <span>Password requirements</span>
          <span className={meetsMinimum ? 'met' : ''}>
            {meetsMinimum ? <Check size={14} /> : <Circle size={10} />}
            At least 10 characters
          </span>
        </div>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        typeof child.type === 'string' &&
        ['input', 'select', 'textarea'].includes(child.type)
          ? cloneElement(child as ReactElement<Record<string, unknown>>, {
              id,
              'aria-describedby': hint ? `${id}-hint` : undefined,
            })
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ArrowUpRight />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${compact ? ' compact-modal' : ''}`}
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button className="button primary" type="submit" disabled={busy}>
      {busy ? 'Saving…' : children}
    </button>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error-text">
      {message}
    </p>
  ) : null;
}
