# Depo Yönetimi MVP

Bu repo, küçük bir mağaza ekibi için mobil uyumlu **depo lokasyon takip MVP** uygulamasını içerir.

## Hedef

- Ürün arama
- Mevcut lokasyon görüntüleme (A1, A2, B1...)
- Lokasyon güncelleme
- Hareket geçmişi takibi
- Telefonda hızlı kullanım

## MVP Özellikleri

- Basit giriş ekranı (demo kullanıcı listesi)
- Ürün adına veya SKU'ya göre arama
- Ürün kartında mevcut lokasyonu görme
- Lokasyon değişikliği kaydetme
- Hareket geçmişini görüntüleme ve filtreleme
- Tüm verilerin tarayıcı `localStorage` üzerinde saklanması

> Not: Bu sürüm, hızlı validasyon için hazırlanmış bir prototiptir. Çoklu cihaz senkronizasyonu yoktur.

## Çalıştırma

Bu proje statik dosyalardan oluşur.

### Seçenek 1 — Dosyayı doğrudan aç

`index.html` dosyasını tarayıcıda aç.

### Seçenek 2 — Basit bir local server

```bash
python3 -m http.server 8080
```

Sonra:

`http://localhost:8080`

## Demo Kullanıcıları

- ali / 1234
- ayse / 1234
- mehmet / 1234
- zeynep / 1234
- can / 1234

## Sonraki Adım Önerisi

Bir sonraki aşamada bu MVP'yi API + veritabanına taşıyarak çoklu kullanıcıyı gerçek zamanlı destekleyebiliriz.
