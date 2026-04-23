# Depo Yönetimi MVP

Bu repo, küçük bir mağaza ekibi için mobil uyumlu depo lokasyon takip MVP uygulamasını içerir.

## Hedef

- Ürün arama
- Barkod ile ürün bulma
- Mevcut lokasyon görüntüleme
- Tekli ve çoklu lokasyon güncelleme
- Hareket geçmişi takibi
- Lokasyona göre ürün listesi görüntüleme

## MVP Özellikleri

- Basit giriş ekranı (demo kullanıcı listesi)
- Ürün adına, SKU'ya, barkoda, markaya ve bedene göre arama
- Kameradan barkod okuma (tarayıcı destekliyorsa)
- Varyanta tıklayınca kart içinde otomatik açılan hızlı lokasyon değiştirme alanı
- Sağ üstteki **Seçim Modu** ile birden fazla ürün seçip toplu lokasyon değişikliği
- Lokasyonu metin yazarak değil, listeden seçerek güncelleme
- Lokasyonlar sekmesinde her lokasyondaki ürünleri görme
- Her SKU tek bir ürün kartı olarak gösterilir; kart içinde varyantlar (barkod + beden + adet + lokasyon) listelenir
- Varyantlar masaüstünde satırda 3 sütun, dar ekranlarda otomatik olarak 2/1 sütuna düşen responsive yapıdadır
- Tüm verilerin merkezi SQLite veritabanında saklanması

> Not: Bu sürümde arayüz doğrudan SQLite API üzerinden çalışır; çoklu cihazda ortak veri kullanımı sağlanır.

## Çalıştırma

### Seçenek 1 — API + frontend birlikte

Önce API'yi başlat:

```bash
python3 backend/server.py
```

Sonra frontend'i aç:

```bash
python3 -m http.server 8080
```

ve `http://localhost:8080` adresine git.

### Seçenek 2 — Sadece frontend dosyasını aç (önerilmez)

`index.html` dosyasını tarayıcıda aç.

> Bu durumda API çalışmıyorsa ürün/hareket verileri gelmez.

## Veritabanı (SQLite) ve API

Projeye merkezi veri yönetimi için SQLite tabanlı bir API eklendi.

### Şema

- `database/schema.sql`
  - `stock_cards` (SKU, marka, ürün adı)
  - `variants` (barkod, beden, adet, lokasyon)
  - `movements` (hareket geçmişi)
  - `users`, `locations`

### API başlatma

```bash
python3 backend/server.py
```

API varsayılan olarak `http://localhost:8787` adresinde çalışır.

### Örnek endpoint'ler

- `GET /api/stock-cards` → stok kartları + varyantlar
- `POST /api/stock-cards` → yeni stok kartı açma
- `POST /api/variants` → stok kartına varyant ekleme
- `PATCH /api/variants/{id}/location` → lokasyon değiştirme + hareket geçmişine yazma
- `GET /api/movements` → ana ekrandaki hareket geçmişi verisi

## Demo Kullanıcıları

- ali / 1234
- ayse / 1234
- mehmet / 1234
- zeynep / 1234
- can / 1234
