import { useState, useRef, useEffect, useImperativeHandle, forwardRef, ChangeEvent, KeyboardEvent, FocusEvent } from 'react';

import style from './Inputs.module.css';

type enterKeyHint = 'search' | 'done' | 'enter' | 'go' | 'next' | 'previous' | 'send' | undefined;
type inputMode = 'search' | 'text' | 'none' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | undefined;

interface input {
    placeholder: string;
    readOnly?: boolean;
    disabled?: boolean;
    enterKey?: enterKeyHint;
    inputMode?: inputMode;
    value?: string;
    error?: string;
    onFocus?: (e: FocusEvent) => void;
    onFocusOut?: (e: FocusEvent) => void;
    setValue: (value: string) => void;
    onChange?: (e: ChangeEvent) => void;
    onEnter?: (e: KeyboardEvent) => void;
}

interface LineInputProps extends input {
    type?: 'text' | 'number' | 'password';
    maxLength?: number;
    align?: 'center';
    cancelBtn?: boolean;
}

interface LineTextareaProps extends input {
    maxHeight?: number;
}

const LineInput = forwardRef(
    (
        {
            type = 'text',
            placeholder,
            maxLength,
            readOnly = false,
            disabled = false,
            enterKey = 'done',
            inputMode = undefined,
            align,
            value = '',
            error = '',
            setValue,
            onChange,
            onEnter,
            cancelBtn = false,
        }: LineInputProps,
        ref
    ) => {
        const [canceled, setCanceled] = useState<boolean>(false);
        const input = useRef<HTMLInputElement | null>(null);

        useImperativeHandle(ref, () => ({
            focus: () => input.current?.focus(), // 부모에서 focus 호출 가능
            click: () => input.current?.click(), // 부모에서 click 호출 가능
            select: () => input.current?.select(), // 부모에서 select 호출 가능
            forceFocus: forceFocus,
        }));

        const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && onEnter) {
                onEnter(e);
            }

            if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
                e.preventDefault();
            }
        };

        const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
            if (onChange) onChange(e);
            setValue(e.target.value);
            if (maxLength && e.target.value.length > e.target.maxLength) {
                setValue(e.target.value.slice(0, e.target.maxLength));
            }
        };

        const cancel = () => {
            setValue('');
            input.current!.value = '';
        };

        const forceFocus = async (timeout = 0) => {
            if (input.current) {
                const temp = document.createElement('input');
                temp.style.position = 'absolute';
                temp.style.top = '0px';
                temp.style.height = '0px';
                temp.style.opacity = '0';
                temp.inputMode = type === 'number' ? 'numeric' : (inputMode as string);
                temp.dataset.target = 'temp';
                document.body.appendChild(temp);
                temp.focus();

                await sleep(timeout);
                input.current.focus();
                document.body.removeChild(temp);
            }
        };

        return (
            <div>
                <div className={style['container--line-input']}>
                    <p className={style['text--line-input--placeholder']}>{placeholder}</p>

                    <div className={style['unit--line-input']}>
                        <input
                            ref={input}
                            onKeyDown={handleKeyDown}
                            onChange={handleChange}
                            value={value || ''}
                            className={[style['input--line-input'], align === 'center' && style['input--line-input--center']].join(' ')}
                            type={type}
                            pattern={type === 'number' ? '[0-9]*' : undefined}
                            inputMode={type === 'number' ? 'numeric' : inputMode}
                            maxLength={maxLength || undefined}
                            readOnly={readOnly}
                            disabled={disabled}
                            enterKeyHint={enterKey}
                            placeholder=" "
                            autoComplete="off"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck="false"
                        />

                        <span className={style['span--line-input']}></span>

                        {cancelBtn && value && !disabled && (
                            <button
                                onClick={cancel}
                                // click events
                                onMouseDown={() => setCanceled(true)}
                                onMouseUp={() => setCanceled(false)}
                                onTouchStart={() => setCanceled(true)}
                                onTouchEnd={() => setCanceled(false)}
                                className={[
                                    style['button--line-input--cancel'],
                                    canceled && style['button--line-input--cancel--clicked'],
                                ].join(' ')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="#AAAAAA">
                                    <path d="M10 20C4.53922 20 0 15.4608 0 10C0 4.52941 4.52941 0 9.9902 0C15.4608 0 20 4.52941 20 10C20 15.4608 15.4706 20 10 20ZM6.54902 14.2745C6.78431 14.2745 6.9902 14.1863 7.14706 14.0294L10 11.1569L12.8726 14.0294C13.0294 14.1765 13.2255 14.2745 13.451 14.2745C13.902 14.2745 14.2647 13.902 14.2647 13.451C14.2647 13.2255 14.1863 13.0392 14.0294 12.8726L11.1569 10.0098L14.0392 7.12745C14.2059 6.95098 14.2745 6.77451 14.2745 6.54902C14.2745 6.10784 13.9118 5.7451 13.4706 5.7451C13.2549 5.7451 13.0784 5.82353 12.9118 5.9902L10 8.87255L7.11765 6C6.97059 5.84314 6.78431 5.76471 6.54902 5.76471C6.10784 5.76471 5.7451 6.11765 5.7451 6.56863C5.7451 6.78431 5.83333 6.98039 5.98039 7.13726L8.85294 10.0098L5.98039 12.8824C5.83333 13.0392 5.7451 13.2353 5.7451 13.451C5.7451 13.902 6.10784 14.2745 6.54902 14.2745Z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <p className={[style['text--error'], error && style['text--error--active']].join(' ')}>{error}</p>
            </div>
        );
    }
);
LineInput.displayName = 'LineInput';

const LineTextarea = forwardRef(
    (
        {
            maxHeight,
            placeholder,
            readOnly = false,
            disabled = false,
            enterKey = 'enter',
            value = '',
            error = '',
            onFocus,
            onFocusOut,
            setValue,
            onChange,
        }: LineTextareaProps,
        ref
    ) => {
        const input = useRef<HTMLTextAreaElement | null>(null);
        const container = useRef<HTMLDivElement | null>(null);

        useEffect(() => {
            if (maxHeight) {
                input.current!.style.maxHeight = `${maxHeight}px`;
            }
        }, [maxHeight]);

        useImperativeHandle(ref, () => ({
            focus: () => input.current?.focus(), // 부모에서 focus 호출 가능
            blur: () => input.current?.blur(),
            offsetTop: container.current?.offsetTop,
            clientHeight: container.current?.clientHeight,
            forceFocus: forceFocus,
        }));

        // 자동 높이 조절 함수
        const adjustHeight = () => {
            if (input.current) {
                input.current.style.height = '0px';
                input.current.style.height = `${input.current.scrollHeight + 3}px`; // 내용에 맞게 조절
            }
        };

        // 값이 변경될 때마다 높이 조정
        useEffect(() => {
            adjustHeight();
        }, [value]);

        const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
            if (onChange) onChange(e);
            setValue(e.target.value);
        };

        const forceFocus = async (timeout = 0) => {
            if (input.current) {
                input.current.blur();
                const temp = document.createElement('input');
                temp.style.position = 'absolute';
                temp.style.top = `${input.current.offsetTop + input.current.clientHeight}px`;
                temp.style.height = '0px';
                temp.style.opacity = '0';
                temp.dataset.target = 'temp';
                container.current?.appendChild(temp);
                temp.focus();

                await sleep(timeout);
                input.current.focus();
                container.current?.removeChild(temp);
            }
        };

        return (
            <div ref={container}>
                <div className={style['container--line-input']}>
                    <p className={style['text--line-input--placeholder']}>{placeholder}</p>

                    <div className={style['unit--line-input']}>
                        <textarea
                            rows={1}
                            ref={input}
                            onChange={handleChange}
                            onFocus={onFocus}
                            onBlurCapture={onFocusOut}
                            value={value || ''}
                            className={style['input--line-textarea']}
                            readOnly={readOnly}
                            disabled={disabled}
                            enterKeyHint={enterKey}
                            placeholder=" "
                            autoComplete="off"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck="false"
                        />
                        <span className={style['span--line-input']}></span>
                    </div>
                </div>

                <p className={[style['text--error'], error && style['text--error--active']].join(' ')}>{error}</p>
            </div>
        );
    }
);
LineTextarea.displayName = 'LineTextarea';

const CheckBox = forwardRef(
    (
        {
            text,
            value,
            checked = false,
            disabled,
            onChange,
            error,
        }: {
            text: string;
            value?: string;
            checked: boolean;
            disabled?: boolean;
            onChange: () => void;
            error?: string;
        },
        ref
    ) => {
        const input = useRef<HTMLInputElement | null>(null);

        useImperativeHandle(ref, () => ({}));

        const handleOnChange = () => {
            onChange();
        };

        return (
            <div className={style['container--checkbox']}>
                <label className={style['label--checkbox']}>
                    {text}
                    <input
                        ref={input}
                        value={value}
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={handleOnChange}
                        className={style['input--checkbox']}
                    ></input>
                    <span className={style['span--checkbox']}></span>
                </label>
                <p className={[style['text--error'], error && style['text--error--active']].join(' ')}>{error}</p>
            </div>
        );
    }
);
CheckBox.displayName = 'CheckBox';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export { LineInput, LineTextarea, CheckBox, sleep };
