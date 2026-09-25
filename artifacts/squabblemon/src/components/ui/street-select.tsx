import { Children, Fragment, isValidElement, useRef, useState, useLayoutEffect, type ReactNode } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import './street-select.css';

type Option = { value: string; label: ReactNode; disabled?: boolean; group?: string };
function optionsFrom(children: ReactNode, group?: string): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return [];
    if (child.type === Fragment) return optionsFrom(child.props.children, group);
    if (child.type === 'optgroup') return optionsFrom(child.props.children, child.props.label);
    if (child.type !== 'option') return [];
    return [{ value: String(child.props.value ?? child.props.children ?? ''), label: child.props.children, disabled: child.props.disabled, group }];
  });
}
const EMPTY = '__street_select_empty__';
type Props = {
  children: ReactNode; value?: string | number; defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  disabled?: boolean; required?: boolean; name?: string; id?: string;
  className?: string; skin?: 'sign' | 'paper';
  'aria-label'?: string; 'aria-labelledby'?: string; 'aria-describedby'?: string;
};
/** Shared accessible selector, including portals inside native dialogs' top layer. */
export function StreetSelect({ children, value, defaultValue, onValueChange, disabled, required, name, id, className = '', skin = 'sign', ...aria }: Props) {
  const options = optionsFrom(children);
  const trigger = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | undefined>();
  useLayoutEffect(() => {
    setContainer(trigger.current?.closest<HTMLElement>('dialog,[role="dialog"]') ?? undefined);
  }, []);
  const encode = (value: string | number) => String(value) || EMPTY;
  return <SelectPrimitive.Root
    value={value === undefined ? undefined : encode(value)}
    defaultValue={defaultValue === undefined ? undefined : encode(defaultValue)}
    onValueChange={next => onValueChange?.(next === EMPTY ? '' : next)}
    disabled={disabled || options.length === 0} required={required} name={name}>
    <SelectPrimitive.Trigger {...aria} id={id} ref={trigger} data-value={value === undefined ? undefined : String(value)}
      className={`street-select-trigger street-select-trigger--${skin} ${className}`}>
      <span className="street-select-value"><SelectPrimitive.Value placeholder="Choose an option" /></span>
      <SelectPrimitive.Icon asChild><ChevronDown size={17} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content className="street-select-content" position="popper" sideOffset={7} collisionPadding={12}>
        <SelectPrimitive.ScrollUpButton className="street-select-scroll"><ChevronUp size={18} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="street-select-viewport">
          {options.map((option, index) => <Fragment key={option.value}>
            {option.group && option.group !== options[index - 1]?.group && <div className="street-select-group">{option.group}</div>}
            <SelectPrimitive.Item className="street-select-item" data-value={option.value} value={encode(option.value)} disabled={option.disabled}>
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="street-select-check"><Check size={17} strokeWidth={3} /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          </Fragment>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="street-select-scroll"><ChevronDown size={18} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
