
import { motion } from 'framer-motion'
import Link from 'next/link'

interface CardProps {
  icon: string
  title: string
  href: string
  children: React.ReactNode
}

export function Card({ icon, title, href, children }: CardProps) {
  return (
    <Link href={href}>
      <motion.div
        className="p-6 border-2 border-gray-200 rounded-xl hover:border-orange-500 transition-all cursor-pointer hover:shadow-lg"
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="text-xl font-bold mb-2 text-gray-900">{title}</h3>
        <p className="text-gray-600">{children}</p>
      </motion.div>
    </Link>
  )
}

export function Cards({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
      {children}
    </div>
  )
}
