
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  publishedAt: string;
  readTime: number;
  image?: string;
}

export default function BlogPage() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const response = await fetch('/api/blog/posts');
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    }
  });

  const categories = ['Community', 'Treasury', 'Governance', 'Success Stories', 'Guides'];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">MtaaDAO Blog</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Stories, guides, and insights from the community
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <Button variant="outline" size="sm">All</Button>
        {categories.map(cat => (
          <Button key={cat} variant="ghost" size="sm">
            {cat}
          </Button>
        ))}
      </div>

      {/* Featured Post */}
      {posts && posts.length > 0 && (
        <Card className="mb-8 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 p-8 flex items-center justify-center">
              <div className="text-6xl">📖</div>
            </div>
            <CardContent className="p-6">
              <Badge className="mb-2">{posts[0].category}</Badge>
              <h2 className="text-2xl font-bold mb-2">{posts[0].title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{posts[0].excerpt}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {posts[0].author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(posts[0].publishedAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {posts[0].readTime} min read
                </span>
              </div>
              <Link href={`/blog/${posts[0].id}`}>
                <Button>
                  Read More <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Posts Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 dark:bg-gray-700" />
              <CardHeader>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </CardHeader>
            </Card>
          ))
        ) : (
          posts?.slice(1).map(post => (
            <Card key={post.id} className="group hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 flex items-center justify-center">
                <span className="text-4xl">📄</span>
              </div>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">{post.category}</Badge>
                <CardTitle className="group-hover:text-purple-600 transition-colors">
                  {post.title}
                </CardTitle>
                <CardDescription>{post.excerpt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                  <span>{post.readTime} min</span>
                </div>
                <Link href={`/blog/${post.id}`}>
                  <Button variant="ghost" className="w-full mt-4">
                    Read Article
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
