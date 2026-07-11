"use client"

import { SignInForm } from "./sign-in-form"
import { useAuth } from "./auth-provider"

export function SignInModal() {
  const { authModalOpen, closeAuthModal } = useAuth()

  if (!authModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign in"
        onClick={closeAuthModal}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-sm">
        <SignInForm onSuccess={closeAuthModal} onClose={closeAuthModal} />
      </div>
    </div>
  )
}
