import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

interface AnimatedCardOptionProps extends HTMLMotionProps<'button'> {
  children: ReactNode
  index?: number
  selected?: boolean
  centered?: boolean
}

/**
 * Campus-adapted option card: uses the supplied card-option brief's staggered
 * entrance, spring hover, and press feedback without hiding sibling choices.
 */
export default function AnimatedCardOption({ children, index = 0, selected = false, centered = false, ...props }: AnimatedCardOptionProps) {
  return <motion.button
    {...props}
    initial={{ opacity: 0, scale: 0.9, y: 16 }}
    animate={{ opacity: 1, scale: selected ? 1.018 : 1, y: 0 }}
    transition={{
      opacity: { duration: 0.28, delay: index * 0.05 },
      y: { type: 'spring', stiffness: 500, damping: 25, delay: index * 0.05 },
      scale: { type: 'spring', stiffness: 500, damping: 25 },
    }}
    whileHover={{ y: -3, scale: selected ? 1.025 : 1.018 }}
    whileTap={{ scale: 0.972, y: 0 }}
    transformTemplate={centered ? (_transform, generatedTransform) => `translate(-50%, -50%) ${generatedTransform}` : undefined}
  >{children}</motion.button>
}
