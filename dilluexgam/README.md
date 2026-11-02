# dilluexGAM — 101 Okey + Monopoly (gerçek zamanlı online)

## Mimari
- `server/index.js` — Express + Socket.io: kayıt/giriş (bcrypt + JWT), odalar, yeniden bağlanma, çevrimiçi sayacı
- `server/okey.js` — 101 Okey kural motoru (dağıtım, gösterge/okey, per/seri/çift doğrulama, ceza puanı)
- `server/monopoly.js` — Monopoly kural motoru (zar, satın alma, kira, ev/otel, açık artırma, hapis, iflas)
- `server/store.js` + `server/schema.sql` — PostgreSQL (users, history)
- `public/` — istemci (HTML/CSS/JS + Three.js). İstemci yalnızca hamle isteği yollar; tüm kurallar ve rastgelelik sunucuda.

## Yerelde çalıştırma
1. `npm install`
2. `.env.example` dosyasını `.env` olarak kopyalayın; `JWT_SECRET` ve `DATABASE_URL` girin
3. (PostgreSQL için) tablolar açılışta `schema.sql` ile otomatik oluşturulur
4. `npm test` (kural motoru testleri) → `npm start` → http://localhost:3000

## İnternette yayınlama (Render örneği)
1. Kodu bir GitHub deposuna yükleyin.
2. Render → New → PostgreSQL oluşturun; "Internal Database URL" değerini kopyalayın.
3. Render → New → Web Service → depoyu seçin. Build: `npm install`, Start: `npm start`.
4. Environment: `DATABASE_URL` (kopyaladığınız değer), `JWT_SECRET` (uzun rastgele metin), `PGSSL=1` (dış bağlantı kullanıyorsanız).
5. Yayınlanan adresi arkadaşlarınızla paylaşın. Railway için de adımlar aynıdır (PostgreSQL eklentisi + `DATABASE_URL`).
Not: ücretsiz planlar uykuya geçebilir; oyun odaları sunucu belleğinde tutulduğundan yeniden başlatmada açık oyunlar kaybolur.

## Bilinen eksikler (dürüst liste)
- Bağımlılıklar kurulamadığı için sunucu bu ortamda uçtan uca (tarayıcı + Socket.io + PostgreSQL) ÇALIŞTIRILMADI. Yalnızca kural motorları test edildi.
- Okey: taşlar 3D değil, düz (DOM) taşlar; çekme/atma animasyonu yok. Açılmış perlere taş ekleme/işleme yok. Elden bitirme bonusu, ceza puanı detayları basitleştirildi.
- Monopoly: tahta ve piyonlar 3D; zar animasyonu yok. Takas, ipotek, Şans/Kamu Fonu kartları sadece basit para/hapis kartları, tek oyuncu oyundan çıkınca (bağlantı) otomatik bota devri yok.
- Arkadaşlar ekranı, profil fotoğrafı yükleme, ses efektleri/müzik, oda sohbeti yok. Avatar rastgele bir renk.
- Giriş denemesi sınırlaması (rate limit) yok; yayına almadan önce ekleyin.
