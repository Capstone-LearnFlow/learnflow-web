'use client';

import React, { useState } from 'react';

const Home = () => {
  const [user, setUser] = useState(null);

  return (
    <div className='home'>
      <div className="section">
        <div className="header">LearnFlow</div>
      </div>
    </div>
  );
};

export default Home;
