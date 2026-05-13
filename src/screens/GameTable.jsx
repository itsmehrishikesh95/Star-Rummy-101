import React from 'react'
import { motion } from 'framer-motion'

export default function GameTable() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(70,18,102,0.38) 0%, rgba(15,8,20,0.12) 38%, rgba(0,0,0,0.88) 100%)',
        }}
      />

      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(92vw, 1180px)',
          height: 'min(72vh, 720px)',
          transform: 'translate(-50%, -50%)',
          borderRadius: '42% / 50%',
          backgroundColor: '#0b1410',
          backgroundImage: "url('/assets/Table.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          boxShadow:
            '0 28px 65px rgba(0,0,0,0.72), inset 0 0 90px rgba(0,0,0,0.28), 0 0 0 2px rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
        animate={{
          scale: [1, 1.008, 1],
          boxShadow: [
            '0 28px 65px rgba(0,0,0,0.72), inset 0 0 90px rgba(0,0,0,0.28), 0 0 0 2px rgba(255,255,255,0.08)',
            '0 34px 80px rgba(0,0,0,0.8), inset 0 0 105px rgba(0,0,0,0.34), 0 0 0 2px rgba(255,255,255,0.1)',
            '0 28px 65px rgba(0,0,0,0.72), inset 0 0 90px rgba(0,0,0,0.28), 0 0 0 2px rgba(255,255,255,0.08)',
          ],
        }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '4.5%',
            borderRadius: '44% / 50%',
            boxShadow: 'inset 0 0 55px rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        />

        <motion.div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '34%',
            height: '26%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(245,197,24,0.18) 0%, rgba(64,214,126,0.12) 38%, rgba(0,0,0,0) 72%)',
            filter: 'blur(18px)',
          }}
          animate={{
            opacity: [0.45, 0.82, 0.45],
            scale: [0.96, 1.04, 0.96],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    </div>
  )
}
