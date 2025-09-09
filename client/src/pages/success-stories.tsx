
import React, { useState, useEffect } from 'react';
import { Heart, Users, DollarSign, TrendingUp, MapPin, Calendar, Star, ArrowRight, Eye, Share2, Sparkles, Award, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SuccessStory = {
  id: string;
  title: string;
  category: 'Community Fundraising' | 'Investment Vehicle' | 'Savings Platform' | 'Local Business' | 'Infrastructure' | 'Education' | 'Insurance Platform';
  location: string;
  amount: string;
  participants: number;
  duration: string;
  impact: string;
  description: string;
  longDescription: string;
  outcomes: string[];
  testimonial: {
    author: string;
    role: string;
    quote: string;
    avatar: string;
  };
  metrics: {
    label: string;
    value: string;
  }[];
  imageUrl?: string;
  status: 'completed' | 'ongoing' | 'expanding';
  tags: string[];
  dateStarted: string;
};

const successStories: SuccessStory[] = [
  {
    id: '1',
    title: 'Kibera Water Access Project',
    category: 'Community Fundraising',
    location: 'Kibera, Nairobi',
    amount: 'KES 2.3M',
    participants: 847,
    duration: '8 months',
    impact: '15,000+ people with clean water access',
    description: 'Community-driven fundraising for clean water infrastructure in Kibera slum.',
    longDescription: 'The Kibera Water Access Project began as a grassroots initiative by local residents who were tired of walking 5+ kilometers daily for clean water. Through MtaaDAO, community members organized transparent fundraising, with every contribution tracked on-chain. Local contractors were vetted through community voting, and progress was documented weekly. The project installed 12 water points, 3 storage tanks, and trained 25 local technicians for maintenance.',
    outcomes: [
      'Reduced water collection time from 5 hours to 15 minutes daily',
      '89% reduction in waterborne diseases in the community',
      'Created 25 permanent jobs for local technicians',
      'Established sustainable maintenance fund through community contributions'
    ],
    testimonial: {
      author: 'Mary Wanjiku',
      role: 'Community Health Volunteer',
      quote: 'Before MtaaDAO, we could never trust that our money would actually build something. Now we see every shilling accounted for, and our children have clean water right in our neighborhood.',
      avatar: '/api/placeholder/64/64'
    },
    metrics: [
      { label: 'Water Points Built', value: '12' },
      { label: 'Daily Beneficiaries', value: '15,000+' },
      { label: 'Community Engagement', value: '94%' }
    ],
    status: 'completed',
    tags: ['Water', 'Health', 'Infrastructure', 'Community'],
    dateStarted: '2023-03-15'
  },
  {
    id: '2',
    title: 'Eastlands Chama Investment Pool',
    category: 'Investment Vehicle',
    location: 'Eastlands, Nairobi',
    amount: 'KES 5.8M',
    participants: 234,
    duration: '18 months',
    impact: '340% average ROI for members',
    description: 'Digital chama leveraging DeFi protocols for community investment opportunities.',
    longDescription: 'Traditional chamas meet modern finance. The Eastlands Investment Pool started with 50 members contributing monthly savings. Through MtaaDAO, they discovered DeFi opportunities, yield farming, and strategic crypto investments. Every investment decision goes through transparent voting, with real-time portfolio tracking. Members can see exactly how their money grows and participate in governance decisions.',
    outcomes: [
      'Average 340% ROI across 18 months',
      'Diversified into 12 different investment vehicles',
      '100% transparency in fund allocation',
      'Financial literacy workshops attended by 500+ community members'
    ],
    testimonial: {
      author: 'James Kimani',
      role: 'Small Business Owner & Pool Member',
      quote: 'I never understood investments before. Now my KES 5,000 monthly contribution has grown to KES 67,000. More importantly, I learned how money can work for me.',
      avatar: '/api/placeholder/64/64'
    },
    metrics: [
      { label: 'Total Pool Value', value: 'KES 5.8M' },
      { label: 'Average Member ROI', value: '340%' },
      { label: 'Investment Diversity', value: '12 Vehicles' }
    ],
    status: 'ongoing',
    tags: ['Investment', 'DeFi', 'Chama', 'Financial Education'],
    dateStarted: '2022-09-20'
  },
  {
    id: '3',
    title: 'Mama Mboga Savings Circle',
    category: 'Savings Platform',
    location: 'Kawangware, Nairobi',
    amount: 'KES 890K',
    participants: 156,
    duration: '12 months',
    impact: '78% increase in business capital',
    description: 'Market vendors using automated savings to grow their businesses.',
    longDescription: 'Market vendors in Kawangware formed a digital savings circle through MtaaDAO. Unlike traditional table banking, their savings earn yield through vault systems while maintaining liquidity for business needs. Automated daily micro-savings of KES 50-200 per vendor, with smart contracts ensuring no one can access funds before agreed periods. The system includes emergency loans and bulk purchasing power for better wholesale rates.',
    outcomes: [
      'Average business capital increased by 78%',
      '23 new permanent stalls opened by members',
      'Group purchasing power reduced wholesale costs by 15%',
      'Emergency loan fund helped 89 members during COVID-19'
    ],
    testimonial: {
      author: 'Grace Nyokabi',
      role: 'Vegetables Vendor & Circle Leader',
      quote: 'Saving KES 100 daily felt impossible until MtaaDAO made it automatic. Now I own three stalls instead of renting one, and my children are in better schools.',
      avatar: '/api/placeholder/64/64'
    },
    metrics: [
      { label: 'Total Saved', value: 'KES 890K' },
      { label: 'New Businesses', value: '23' },
      { label: 'Members Supported', value: '156' }
    ],
    status: 'expanding',
    tags: ['Savings', 'Small Business', 'Women', 'Market Vendors'],
    dateStarted: '2023-01-10'
  },
  {
    id: '4',
    title: 'Mathare Youth Tech Hub',
    category: 'Education',
    location: 'Mathare, Nairobi',
    amount: 'KES 1.2M',
    participants: 312,
    duration: '10 months',
    impact: '89 youth employed in tech',
    description: 'Community-funded coding bootcamp creating tech jobs for slum youth.',
    longDescription: 'Mathare residents noticed their youth had no opportunities despite being tech-savvy with phones. Through MtaaDAO, they crowdfunded a coding bootcamp, complete with computers, internet, and instructor salaries. The curriculum focuses on practical skills: web development, mobile apps, and freelancing. Graduates are connected with remote work opportunities and local tech companies. The program is self-sustaining through graduate job placement fees.',
    outcomes: [
      '89 graduates employed in tech roles',
      'Average salary increase of 450% for participants',
      '12 startups launched by graduates',
      'Program became financially self-sustaining'
    ],
    testimonial: {
      author: 'Kevin Mutiso',
      role: 'Program Graduate & Software Developer',
      quote: 'I was selling phones in the market. Now I build apps for international clients from my home in Mathare. MtaaDAO changed my entire family\'s trajectory.',
      avatar: '/api/placeholder/64/64'
    },
    metrics: [
      { label: 'Youth Trained', value: '312' },
      { label: 'Job Placement Rate', value: '89%' },
      { label: 'Startups Created', value: '12' }
    ],
    status: 'expanding',
    tags: ['Education', 'Youth', 'Technology', 'Employment'],
    dateStarted: '2023-02-01'
  },
  {
    id: '5',
    title: 'Nakuru Farmers Cooperative',
    category: 'Investment Vehicle',
    location: 'Nakuru County',
    amount: 'KES 3.4M',
    participants: 428,
    duration: '14 months',
    impact: '200% increase in farm yields',
    description: 'Digital cooperative pooling resources for modern farming equipment and techniques.',
    longDescription: 'Small-scale farmers in Nakuru were struggling with outdated equipment and limited access to quality inputs. Through MtaaDAO, they formed a digital cooperative that pools resources for bulk purchasing, shared equipment, and modern farming techniques. Members contribute monthly to a shared fund, vote on equipment purchases, and share resources based on farm size and contribution levels. The system includes crop insurance and guaranteed market access through group negotiations.',
    outcomes: [
      'Average crop yields increased by 200%',
      'Farming costs reduced by 35% through bulk purchasing',
      'All members achieved food security',
      'Surplus income invested in children\'s education and healthcare'
    ],
    testimonial: {
      author: 'Peter Karanja',
      role: 'Small-Scale Farmer & Cooperative Chairman',
      quote: 'Individually, we were weak. Together through MtaaDAO, we have modern tractors, quality seeds, and guaranteed buyers. My half-acre now feeds my family and pays school fees.',
      avatar: '/api/placeholder/64/64'
    },
    metrics: [
      { label: 'Farmers Benefiting', value: '428' },
      { label: 'Yield Increase', value: '200%' },
      { label: 'Cost Reduction', value: '35%' }
    ],
    status: 'completed',
    tags: ['Agriculture', 'Cooperative', 'Rural Development', 'Food Security'],
    dateStarted: '2022-11-15'
  },
  {
    id: '6',
    title: 'Mombasa Boda Boda Insurance',
    category: 'Insurance Platform',
    location: 'Mombasa',
    amount: 'KES 780K',
    participants: 267,
    duration: '6 months',
    impact: '95% claim satisfaction rate',
    description: 'Community-owned insurance pool for motorcycle taxi operators.',
    longDescription: 'Boda boda operators in Mombasa faced constant financial risk from accidents, theft, and bike breakdowns, with no access to affordable insurance. Through MtaaDAO, they created their own mutual insurance fund. Members contribute daily premiums of KES 20-50, with claims processed through transparent community voting. Smart contracts automate payouts for verified claims, while a emergency fund provides immediate assistance for accidents.',
    outcomes: [
      '267 operators covered with comprehensive insurance',
      '95% of claims processed within 48 hours',
      'Zero fraudulent claims due to community verification',
      'Average claim payout time reduced from 3 months to 2 days'
    ],
    testimonial: {
      author: 'Hassan Mohammed',
      role: 'Boda Boda Operator',
      quote: 'When my bike was stolen, I got a replacement within 3 days. With traditional insurance, I would still be walking. Our community takes care of its own.',
      avatar: '/api/placeholder/64/64'
    },
    metrics: [
      { label: 'Operators Covered', value: '267' },
      { label: 'Claims Processed', value: '156' },
      { label: 'Satisfaction Rate', value: '95%' }
    ],
    status: 'ongoing',
    tags: ['Insurance', 'Transport', 'Community', 'Risk Management'],
    dateStarted: '2023-05-20'
  }
];

const categoryColors = {
  'Community Fundraising': 'from-blue-500 to-cyan-500',
  'Investment Vehicle': 'from-green-500 to-emerald-500',
  'Savings Platform': 'from-purple-500 to-pink-500',
  'Local Business': 'from-orange-500 to-red-500',
  'Infrastructure': 'from-indigo-500 to-purple-500',
  'Education': 'from-yellow-500 to-orange-500',
  'Insurance Platform': 'from-teal-500 to-green-500'
};

const statusColors = {
  'completed': 'bg-green-500/20 text-green-400 border-green-500/30',
  'ongoing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'expanding': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
};

export default function SuccessStoriesPage() {
  const [selectedStory, setSelectedStory] = useState<SuccessStory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const categories = ['All', ...Array.from(new Set(successStories.map(story => story.category)))];
  const filteredStories = selectedCategory === 'All' 
    ? successStories 
    : successStories.filter(story => story.category === selectedCategory);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-purple-100 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-orange-300/30 to-red-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-purple-300/30 to-pink-300/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Cursor glow effect */}
      <div 
        className="fixed pointer-events-none w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-r from-orange-400 to-pink-400 transition-all duration-300 z-10"
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      />

      <div className="relative z-20 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4">
              Success Stories
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real communities, real impact. See how MtaaDAO is transforming lives across Kenya through 
              transparent, community-driven financial solutions.
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <div className="text-3xl font-bold text-orange-600 mb-2">KES 14.4M+</div>
              <div className="text-gray-600 font-medium">Total Funds Managed</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <div className="text-3xl font-bold text-purple-600 mb-2">2,344</div>
              <div className="text-gray-600 font-medium">Community Members</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <div className="text-3xl font-bold text-green-600 mb-2">45,000+</div>
              <div className="text-gray-600 font-medium">Lives Impacted</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
              <div className="text-3xl font-bold text-blue-600 mb-2">98%</div>
              <div className="text-gray-600 font-medium">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                  : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/90'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <AnimatePresence>
            {filteredStories.map((story, index) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105"
                onClick={() => setSelectedStory(story)}
              >
                {/* Category Badge */}
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r ${categoryColors[story.category]} mb-4`}>
                  {story.category}
                </div>

                {/* Status Badge */}
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ml-2 mb-4 border ${statusColors[story.status]}`}>
                  {story.status.charAt(0).toUpperCase() + story.status.slice(1)}
                </div>

                {/* Title and Location */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                  {story.title}
                </h3>
                <div className="flex items-center text-gray-600 mb-3">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="text-sm">{story.location}</span>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{story.amount}</div>
                    <div className="text-xs text-gray-500">Total Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{story.participants}</div>
                    <div className="text-xs text-gray-500">Participants</div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {story.description}
                </p>

                {/* Impact */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center text-orange-600">
                    <Target className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Impact</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-600 mb-4">
                  {story.impact}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {story.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Read More Button */}
                <button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-xl font-medium hover:shadow-lg transition-all duration-300 flex items-center justify-center">
                  Read Full Story
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-white/80 backdrop-blur-xl rounded-2xl p-12 shadow-lg">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Create Your Own Success Story?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Join thousands of Kenyans building stronger communities through transparent, 
            decentralized financial solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              Start Your DAO Today
            </button>
            <button className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg border-2 border-orange-500 hover:bg-orange-50 transition-all duration-300">
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Story Modal */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedStory(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-4xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r ${categoryColors[selectedStory.category]} mb-2`}>
                    {selectedStory.category}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedStory.title}</h2>
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{selectedStory.location}</span>
                    <Calendar className="w-4 h-4 ml-4 mr-2" />
                    <span>{selectedStory.duration}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStory(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {selectedStory.metrics.map((metric, index) => (
                  <div key={index} className="text-center bg-gray-50 rounded-xl p-4">
                    <div className="text-2xl font-bold text-orange-600 mb-1">{metric.value}</div>
                    <div className="text-gray-600 text-sm">{metric.label}</div>
                  </div>
                ))}
              </div>

              {/* Long Description */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">The Full Story</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  {selectedStory.longDescription}
                </p>
              </div>

              {/* Outcomes */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Key Outcomes</h3>
                <div className="space-y-3">
                  {selectedStory.outcomes.map((outcome, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-3 mt-1">
                        <span className="text-white text-sm">✓</span>
                      </div>
                      <span className="text-gray-600">{outcome}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Testimonial */}
              <div className="bg-orange-50 rounded-xl p-6 mb-8">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl">
                    {selectedStory.testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 italic mb-4">
                      "{selectedStory.testimonial.quote}"
                    </p>
                    <div>
                      <div className="font-semibold text-gray-900">{selectedStory.testimonial.author}</div>
                      <div className="text-gray-600 text-sm">{selectedStory.testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {selectedStory.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-300">
                  Start Similar Project
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-300 flex items-center">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
