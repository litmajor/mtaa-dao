
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Mail, Phone, Clock, CheckCircle, Sparkles } from 'lucide-react';
import { MorioChat } from '@/components/morio/MorioChat';
import { useAuth } from '@/pages/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showMorio, setShowMorio] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || user?.username || '',
    email: user?.email || '',
    category: 'general',
    priority: 'normal',
    subject: '',
    message: ''
  });

  const submitTicket = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to submit ticket');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Support ticket created',
        description: 'Our team will get back to you within 24-48 hours.'
      });
      setFormData({
        ...formData,
        subject: '',
        message: ''
      });
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Support Center
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Get help from our team or chat with Morio AI for instant answers
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {/* Support Channels */}
        <Card>
          <CardHeader>
            <MessageCircle className="w-8 h-8 mb-2 text-purple-600" />
            <CardTitle>Chat with Morio AI</CardTitle>
            <CardDescription>Instant answers 24/7</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowMorio(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Mail className="w-8 h-8 mb-2 text-blue-600" />
            <CardTitle>Email Support</CardTitle>
            <CardDescription>Response within 24-48 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="mailto:support@mtaadao.com">
              <Button variant="outline" className="w-full">
                support@mtaadao.com
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Phone className="w-8 h-8 mb-2 text-green-600" />
            <CardTitle>WhatsApp Support</CardTitle>
            <CardDescription>Mon-Fri, 8AM-6PM EAT</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="https://wa.me/254XXXXXXXXX" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">
                +254 XXX XXXXXX
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Response Times */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Expected Response Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Badge className="mb-2">Free Tier</Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">3-5 business days</p>
            </div>
            <div>
              <Badge className="mb-2">Short-Term</Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">2-3 business days</p>
            </div>
            <div>
              <Badge className="mb-2">Collective</Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">24-48 hours</p>
            </div>
            <div>
              <Badge className="mb-2">MetaDAO</Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">&lt;24 hours</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support Ticket Form */}
      <Card>
        <CardHeader>
          <CardTitle>Submit a Support Ticket</CardTitle>
          <CardDescription>Fill out the form below and we'll get back to you soon</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); submitTicket.mutate(formData); }} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option value="general">General Question</option>
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing & Payments</option>
                  <option value="account">Account & Access</option>
                  <option value="dao">DAO Management</option>
                  <option value="security">Security Concern</option>
                </select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                placeholder="Brief description of your issue"
                required
              />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Please provide as much detail as possible..."
                rows={6}
                required
              />
            </div>

            <Button type="submit" disabled={submitTicket.isPending} className="w-full">
              {submitTicket.isPending ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Morio Chat Modal */}
      {showMorio && user && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Chat with Morio AI</h2>
              <Button variant="ghost" onClick={() => setShowMorio(false)}>✕</Button>
            </div>
            <div className="h-[600px]">
              <MorioChat userId={user.id.toString()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
