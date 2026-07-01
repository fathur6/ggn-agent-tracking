import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { GraduationCap } from 'lucide-react'
import { useEffect } from 'react'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      if (!credentialResponse.credential) return
      await login(credentialResponse.credential)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-surface rounded-xl border border-border shadow-lg text-center">
        <GraduationCap className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">
          UniSZA Graduate School
        </h1>
        <p className="text-sm text-muted mb-6">
          Agent Tracking & Student Pipeline
        </p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error('Google sign-in failed')}
            theme="outline"
            size="large"
            shape="rectangular"
            text="signin_with"
          />
        </div>
        <p className="text-xs text-muted mt-4">
          Sign in with your authorized UniSZA Google account
        </p>
      </div>
    </div>
  )
}
