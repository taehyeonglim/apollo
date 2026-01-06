/**
 * 기본 캐릭터 시드 데이터 등록 스크립트
 *
 * 사용법:
 * 1. Firebase Admin SDK 설정
 * 2. node scripts/seed-character.js
 *
 * 또는 Firebase 에뮬레이터 UI에서 직접 추가
 */

const admin = require('firebase-admin');

// Firebase Admin 초기화 (서비스 계정 키 필요)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// 에뮬레이터 사용 시
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'demo-apollo' });

const db = admin.firestore();

const defaultCharacter = {
  name: '뽀미',
  description: `20대 여성 캐릭터입니다. 귀엽고 친근한 인상을 가지고 있으며,
큰 눈과 동그란 얼굴이 특징입니다. 일상의 소소한 감정을 풍부하게 표현합니다.
다양한 상황에서 공감을 이끌어내는 캐릭터로, 유머러스하면서도 감성적인 면을 가지고 있습니다.`,
  referenceImageUrls: [],
  defaultStyle: 'cute cartoon webtoon style, soft pastel colors, expressive emotions, clean lines',
  traits: {
    age: 'early 20s',
    gender: 'female',
    hairStyle: 'shoulder-length bob with slight wave',
    hairColor: 'dark brown',
    eyeColor: 'dark brown, big round expressive eyes',
    skinTone: 'fair with warm undertone',
    height: 'average (about 160cm)',
    bodyType: 'slim and petite',
    clothing: 'casual comfortable clothes, often hoodie or oversized t-shirt, sometimes pajamas',
    accessories: ['round glasses (sometimes)', 'hair clips', 'scrunchie'],
    distinctiveFeatures: [
      'big expressive eyes that show emotions clearly',
      'small cute nose',
      'round soft face shape',
      'blush marks on cheeks when embarrassed',
      'various cute expressions'
    ]
  }
};

async function seedCharacter() {
  try {
    await db.collection('characters').doc('default').set(defaultCharacter);
    console.log('✅ 기본 캐릭터가 등록되었습니다!');
    console.log('캐릭터 ID: default');
    console.log('캐릭터 이름:', defaultCharacter.name);
  } catch (error) {
    console.error('❌ 캐릭터 등록 실패:', error);
  } finally {
    process.exit();
  }
}

seedCharacter();
