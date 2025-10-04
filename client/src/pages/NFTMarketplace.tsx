
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ShoppingCart, TrendingUp, Award, Filter, Search } from 'lucide-react';

interface NFTListing {
  tokenId: number;
  name: string;
  category: string;
  rarity: number;
  price: string;
  seller: string;
  imageUrl: string;
}

export default function NFTMarketplace() {
  const [listings, setListings] = useState<NFTListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: 'all', rarity: 'all', sort: 'price-low' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchListings();
  }, [filter]);

  const fetchListings = async () => {
    try {
      const res = await fetch('/api/nft-marketplace/listings');
      const data = await res.json();
      setListings(data.listings || []);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: number) => {
    switch (rarity) {
      case 1: return 'bg-gray-500';
      case 2: return 'bg-blue-500';
      case 3: return 'bg-purple-500';
      case 4: return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getRarityLabel = (rarity: number) => {
    switch (rarity) {
      case 1: return 'Common';
      case 2: return 'Rare';
      case 3: return 'Epic';
      case 4: return 'Legendary';
      default: return 'Unknown';
    }
  };

  const handleBuy = async (tokenId: number) => {
    try {
      const res = await fetch('/api/nft-marketplace/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId })
      });
      
      if (res.ok) {
        alert('NFT purchased successfully!');
        fetchListings();
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Achievement NFT Marketplace
          </h1>
          <p className="text-gray-600">Trade and collect unique DAO achievement badges</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Volume</p>
                  <p className="text-2xl font-bold">1,250 CELO</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Floor Price</p>
                  <p className="text-2xl font-bold">2.5 CELO</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unique Owners</p>
                  <p className="text-2xl font-bold">128</p>
                </div>
                <Award className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">24h Volume</p>
                  <p className="text-2xl font-bold">85 CELO</p>
                </div>
                <TrendingUp className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search NFTs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="PIONEER">Pioneer</SelectItem>
                  <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                  <SelectItem value="VOTER">Voter</SelectItem>
                  <SelectItem value="ELDER">Elder</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filter.rarity} onValueChange={(v) => setFilter({ ...filter, rarity: v })}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  <SelectItem value="1">Common</SelectItem>
                  <SelectItem value="2">Rare</SelectItem>
                  <SelectItem value="3">Epic</SelectItem>
                  <SelectItem value="4">Legendary</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filter.sort} onValueChange={(v) => setFilter({ ...filter, sort: v })}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                  <SelectItem value="recent">Recently Listed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* NFT Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {listings.map((nft) => (
            <Card key={nft.tokenId} className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="aspect-square bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center">
                <Award className="w-24 h-24 text-white" />
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{nft.name}</h3>
                    <p className="text-sm text-gray-600">#{nft.tokenId}</p>
                  </div>
                  <Badge className={getRarityColor(nft.rarity)}>
                    {getRarityLabel(nft.rarity)}
                  </Badge>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500">Seller</p>
                  <p className="text-sm font-mono">{nft.seller.slice(0, 10)}...</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-xl font-bold">{parseFloat(nft.price) / 1e18} CELO</p>
                  </div>
                  <Button onClick={() => handleBuy(nft.tokenId)}>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Buy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
