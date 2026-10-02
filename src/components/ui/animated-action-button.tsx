import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

interface AnimatedActionButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode
}

const actionTransition = { type: 'spring' as const, stiffness: 350, damping: 28 }

/** Main actions use a compact spring so tap feedback remains visible on touch devices. */
export default function AnimatedActionButton({ children, ...props }: AnimatedActionButtonProps) {
  return <motion.button {...props} initial={false} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.965, y: 0 }} transition={actionTransition}>{children}</motion.button>
}
