
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, ArrowLeft, Share2 } from 'lucide-react';
import { Link } from 'wouter';

export default function BlogPostPage() {
  const [, params] = useRoute('/blog/:id');
  const postId = params?.id;

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: async () => {
      const response = await fetch(`/api/blog/posts/${postId}`);
      if (!response.ok) throw new Error('Failed to fetch post');
      return response.json();
    },
    enabled: !!postId
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!post) return <div>Post not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/blog">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Button>
      </Link>

      <article>
        <Badge className="mb-4">{post.category}</Badge>
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {post.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(post.publishedAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {post.readTime} min read
          </span>
        </div>

        <div className="h-96 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 rounded-lg mb-8 flex items-center justify-center">
          <span className="text-8xl">📖</span>
        </div>

        <Card>
          <CardContent className="p-8">
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </CardContent>
        </Card>

        <div className="mt-8 flex gap-4">
          <Button variant="outline">
            <Share2 className="w-4 h-4 mr-2" />
            Share Article
          </Button>
        </div>
      </article>
    </div>
  );
}
