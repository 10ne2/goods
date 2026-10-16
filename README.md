# 차곡
구매 상품의 원가와 배송비, 판매가와 수수료를 기록하는 개인용 웹 가계부.

## 개발
Node.js 22.12 이상(현재 검증: 24.19), npm을 사용합니다.

```sh
npm ci
npm run dev -- --port 5173
```

```sh
npm test
npm run build
```

구매 기록 추가·수정·삭제, 판매 등록·수정·취소, 검색과 상태 필터, CSV 내보내기를 지원합니다. 손익은 판매가에서 구매가·구매 배송비·기타 비용·판매 배송비·수수료를 차감합니다. 판매하지 않은 상품은 판매 손익에 포함하지 않습니다.

데이터는 현재 브라우저의 localStorage에 저장됩니다. 계정·서버 동기화는 없으며 브라우저 데이터 삭제 시 기록도 사라집니다. 중요한 기록은 CSV로 백업하세요. CSV 가져오기는 아직 지원하지 않습니다.

## GitHub Pages 배포
`.github/workflows/pages.yml`이 main 브랜치의 변경을 테스트하고 `/goods/` 경로로 빌드한 뒤 배포합니다. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택해야 합니다. 예상 주소는 https://10ne2.github.io/goods/ 입니다. GitHub Pages 활성화 및 성공한 배포가 있어야 이 주소로 접속할 수 있습니다.
