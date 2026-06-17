import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function StrategyGalleryPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Strategy Gallery — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Strategy Gallery</h1>
      <p className="text-sm text-slate-500 mt-2">Browse templates and apply them in the Visual Strategy Builder.</p>
    </div>
  );
}
