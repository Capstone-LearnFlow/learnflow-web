'use client';

import React, { useState } from 'react';

const Home = () => {
  const [user, setUser] = useState(null);

  return (
    <div className='home'>
      <div className="section">
        <div className="header">LearnFlow</div>
      </div>
      <div className='section section--large'>
        <div className='card card--signin'>
          <input
            type="number"
            className="signin__input"
            placeholder="학번"
          />
          <div className='btn btn--signin'>로그인</div>
        </div>
      </div>
    </div>
  );
};

export default Home;
