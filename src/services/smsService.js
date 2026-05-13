export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendOTPviaSMS(phone, otp) {
  console.log('ENV KEY:', import.meta.env.VITE_FAST2SMS_KEY)
  console.log('ALL ENV:', import.meta.env)
  // DEV MODE: returning fake OTP without calling Fast2SMS
  console.log('DEV MODE: OTP is 123456')
  // TODO: Re-enable real OTP after Fast2SMS recharge (min ₹100 required)
  /*
  const apiKey = import.meta.env.VITE_FAST2SMS_KEY
  if (!apiKey) {
    throw new Error('Fast2SMS API key not found in .env file')
  }
  const message = `Your Star Rummy OTP is ${otp}. Valid for 5 minutes.`
  const url = `/fast2sms/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(message)}&language=english&flash=0&numbers=${phone}`
  
  console.log('Sending OTP to:', phone)
  console.log('API Key found:', !!apiKey)
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' }
  })
  
  const data = await response.json()
  console.log('Fast2SMS response:', data)
  
  if (!data.return) {
    throw new Error(data.message || 'Failed to send OTP')
  }
  return true
  */
  // fake return to simulate success
  return true
}