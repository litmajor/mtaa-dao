
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, User, ArrowRight, Search, TrendingUp, BookOpen, MessageCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';

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
  featured?: boolean;
}

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const response = await fetch('/api/blog/posts');
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    }
  });

  const categories = ['Getting Started', 'Treasury Management', 'Governance', 'Success Stories', 'Community', 'Technical'];

  const filteredPosts = posts?.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPost = posts?.find(p => p.featured);
  const regularPosts = filteredPosts?.filter(p => !p.featured);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          MtaaDAO Blog & Resources
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Stories, guides, and insights from the community
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href="/support">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-purple-200 dark:border-purple-800">
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-600" />
              <h3 className="font-bold mb-2">Support Center</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Get help from our team or Morio AI</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/faq">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-200 dark:border-blue-800">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-blue-600" />
              <h3 className="font-bold mb-2">FAQ Center</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">70+ questions answered</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/success-stories/submit">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-200 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-green-600" />
              <h3 className="font-bold mb-2">Share Your Story</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Inspire others with your success</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="mb-8">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Featured Post */}
      {featuredPost && (
        <Card className="mb-8 overflow-hidden border-2 border-purple-200 dark:border-purple-800">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 p-8 flex items-center justify-center">
              <div className="text-6xl">✨</div>
            </div>
            <CardContent className="p-6">
              <Badge className="mb-2 bg-purple-600">Featured</Badge>
              <h2 className="text-2xl font-bold mb-2">{featuredPost.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{featuredPost.excerpt}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {featuredPost.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(featuredPost.publishedAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {featuredPost.readTime} min read
                </span>
              </div>
              <Link href={`/blog/${featuredPost.id}`}>
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
          regularPosts?.map(post => (
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
