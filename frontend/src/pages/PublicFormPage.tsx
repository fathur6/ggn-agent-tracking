import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { GraduationCap, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  passport: z.string().min(1, 'Passport number is required'),
  nationality: z.string().optional(),
  structure: z.enum(['Research', 'Mixed Mode', 'Coursework']),
  programme: z.string().min(1, 'Programme is required'),
  campaign: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function PublicFormPage() {
  const { agentId, formId } = useParams()
  const [submitted, setSubmitted] = useState(false)
  const [appId, setAppId] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { structure: 'Research' },
  })

  const structure = watch('structure')

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await api.post('/leads', {
        ...data,
        agentId,
        formId,
      })
      setAppId(res.data.applicationId)
      setSubmitted(true)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      toast.error(error.response?.data?.error || 'Submission failed. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-surface border-border text-center">
          <CardContent className="p-8">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Application Submitted!</h1>
            <p className="text-muted-foreground mb-2">
              Your Application ID:{' '}
              <span className="font-mono font-bold text-foreground">{appId}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Check your email for the conditional offer letter.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Submit Another
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-10 px-4">
      <Card className="w-full max-w-lg bg-surface border-border">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <GraduationCap className="w-10 h-10 text-primary mx-auto mb-2" />
            <h1 className="text-xl font-bold text-foreground">
              UniSZA Postgraduate Application
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fill in your details to receive a conditional offer
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name (as in Passport)</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && (
                <p className="text-destructive text-xs mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="passport">Passport Number</Label>
              <Input id="passport" {...register('passport')} />
              {errors.passport && (
                <p className="text-destructive text-xs mt-1">{errors.passport.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" {...register('nationality')} />
            </div>

            <div>
              <Label>Structure</Label>
              <Select
                value={structure}
                onValueChange={(v) => setValue('structure', v as FormValues['structure'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Research">Research</SelectItem>
                  <SelectItem value="Mixed Mode">Mixed Mode</SelectItem>
                  <SelectItem value="Coursework">Coursework</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="programme">Programme</Label>
              <Input
                id="programme"
                {...register('programme')}
                placeholder="e.g., Master of Science (Computer Science)"
              />
              {errors.programme && (
                <p className="text-destructive text-xs mt-1">{errors.programme.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="campaign">How did you hear about us?</Label>
              <Input
                id="campaign"
                {...register('campaign')}
                placeholder="e.g., UGS Tour Location"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
