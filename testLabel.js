const { generateLabel } = require('./src/utils/labelGenerator');
const fs = require('fs');
const path = require('path');

const mockShipment = {
  tracking_id: 'TEST123456',
  sender_name: 'John Doe',
  sender_phone: '1234567890',
  sender_address: '123 Sender St, City',
  receiver_name: 'Jane Smith',
  receiver_phone: '0987654321',
  receiver_address: '456 Receiver Ave, Town',
  payment_type: 'COD',
  cod_amount: 500,
  weight: 1.5
};

async function test() {
  try {
    console.log('Generating label...');
    const fileName = await generateLabel(mockShipment);
    console.log('Label generated:', fileName);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
