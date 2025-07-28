import React from 'react';

const ClientUpload: React.FC = () => {
  console.log('ClientUpload component rendered - SIMPLE TEST');
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'red', 
      color: 'white', 
      padding: '20px',
      fontSize: '24px',
      textAlign: 'center'
    }}>
      <h1>TEST: ClientUpload Component is Working!</h1>
      <p>If you can see this, the component is rendering correctly.</p>
      <p>This is a simple test to verify the component loads.</p>
    </div>
  );
};

export default ClientUpload;