
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, TrendingUp, Users, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function SubmitSuccessStory() {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    daoId: '',
    title: '',
    category: '',
    location: '',
    amount: '',
    participants: '',
    duration: '',
    impact: '',
    shortDescription: '',
    fullStory: '',
    outcomes: ['', '', ''],
    testimonialAuthor: '',
    testimonialRole: '',
    testimonialQuote: '',
    contactEmail: user?.email || '',
    contactPhone: ''
  });

  const submitStory = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/success-stories/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to submit story');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success story submitted!',
        description: 'Thank you for sharing. Our team will review and publish it soon.'
      });
      setLocation('/success-stories');
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          Share Your Success Story
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Inspire other communities by sharing how MtaaDAO helped you achieve your goals
        </p>
      </div>

      {/* Why Share */}
      <Card className="mb-8 border-green-200 dark:border-green-800">
        <CardContent className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Why Share Your Story?
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              Inspire other communities to organize and achieve their goals
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              Get featured on our homepage and social media
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              Receive a "Success Story" badge for your DAO
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              Help us improve MtaaDAO based on real-world feedback
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Submission Form */}
      <Card>
        <CardHeader>
          <CardTitle>Tell Us Your Story</CardTitle>
          <CardDescription>All fields are required unless marked optional</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); submitStory.mutate(formData); }} className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Story Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Kibera Water Access Project"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      className="w-full px-3 py-2 border rounded-md"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      required
                    >
                      <option value="">Select category</option>
                      <option value="Community Fundraising">Community Fundraising</option>
                      <option value="Investment Vehicle">Investment Vehicle</option>
                      <option value="Savings Platform">Savings Platform</option>
                      <option value="Local Business">Local Business</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Education">Education</option>
                      <option value="Healthcare">Healthcare</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="e.g., Kibera, Nairobi"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Impact Metrics</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount">Total Amount Raised</Label>
                  <Input
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="e.g., KES 2.3M"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="participants">Number of Participants</Label>
                  <Input
                    id="participants"
                    type="number"
                    value={formData.participants}
                    onChange={(e) => setFormData({...formData, participants: e.target.value})}
                    placeholder="e.g., 847"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData({...formData, duration: e.target.value})}
                    placeholder="e.g., 8 months"
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="impact">Primary Impact</Label>
                <Input
                  id="impact"
                  value={formData.impact}
                  onChange={(e) => setFormData({...formData, impact: e.target.value})}
                  placeholder="e.g., 15,000+ people with clean water access"
                  required
                />
              </div>
            </div>

            {/* Story Content */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Your Story</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="shortDescription">Short Description (1-2 sentences)</Label>
                  <Textarea
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({...formData, shortDescription: e.target.value})}
                    placeholder="Brief summary that will appear in listings"
                    rows={2}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fullStory">Full Story (3-4 paragraphs)</Label>
                  <Textarea
                    id="fullStory"
                    value={formData.fullStory}
                    onChange={(e) => setFormData({...formData, fullStory: e.target.value})}
                    placeholder="Tell the complete story - the challenge, how you organized, what you achieved..."
                    rows={8}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Outcomes */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Key Outcomes (3-5 bullet points)</h3>
              {formData.outcomes.map((outcome, idx) => (
                <div key={idx} className="mb-2">
                  <Input
                    value={outcome}
                    onChange={(e) => {
                      const newOutcomes = [...formData.outcomes];
                      newOutcomes[idx] = e.target.value;
                      setFormData({...formData, outcomes: newOutcomes});
                    }}
                    placeholder={`Outcome ${idx + 1}`}
                    required={idx < 3}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({...formData, outcomes: [...formData.outcomes, '']})}
              >
                Add Another Outcome
              </Button>
            </div>

            {/* Testimonial */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Member Testimonial</h3>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="testimonialAuthor">Name</Label>
                    <Input
                      id="testimonialAuthor"
                      value={formData.testimonialAuthor}
                      onChange={(e) => setFormData({...formData, testimonialAuthor: e.target.value})}
                      placeholder="e.g., Mary Wanjiku"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="testimonialRole">Role</Label>
                    <Input
                      id="testimonialRole"
                      value={formData.testimonialRole}
                      onChange={(e) => setFormData({...formData, testimonialRole: e.target.value})}
                      placeholder="e.g., Community Health Volunteer"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="testimonialQuote">Quote</Label>
                  <Textarea
                    id="testimonialQuote"
                    value={formData.testimonialQuote}
                    onChange={(e) => setFormData({...formData, testimonialQuote: e.target.value})}
                    placeholder="A powerful quote from a member about the impact..."
                    rows={3}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Information (for verification)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Phone (Optional)</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                    placeholder="+254..."
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitStory.isPending}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600"
            >
              {submitStory.isPending ? 'Submitting...' : 'Submit Success Story'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
