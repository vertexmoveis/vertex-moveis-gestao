import { cn } from '@/lib/utils'
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#121212]">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-white border border-[#D9D9D9] rounded-lg px-3 py-2 text-sm text-[#121212] placeholder:text-[#9E9E9E]',
              'focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent',
              'disabled:bg-[#F5F5F5] disabled:cursor-not-allowed',
              'transition-all duration-150',
              icon && 'pl-9',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#121212]">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full bg-white border border-[#D9D9D9] rounded-lg px-3 py-2 text-sm text-[#121212] placeholder:text-[#9E9E9E]',
            'focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent',
            'disabled:bg-[#F5F5F5] disabled:cursor-not-allowed resize-none',
            'transition-all duration-150',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          rows={3}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#121212]">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full bg-white border border-[#D9D9D9] rounded-lg px-3 py-2 text-sm text-[#121212]',
            'focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent',
            'disabled:bg-[#F5F5F5] disabled:cursor-not-allowed',
            'transition-all duration-150',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
