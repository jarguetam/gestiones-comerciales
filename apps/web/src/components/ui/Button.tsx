import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonVariants'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  )
}
