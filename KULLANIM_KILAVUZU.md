# Ersan Plastik — Enjeksiyon Kontrol Sistemi
## Kullanma Kılavuzu

---

## İÇİNDEKİLER

1. [Sistem Hakkında](#1-sistem-hakkında)
2. [İlk Kurulum — Yönetici](#2-i̇lk-kurulum--yönetici)
3. [Telefona Kurulum — PWA](#3-telefona-kurulum--pwa)
4. [Giriş Sayfası](#4-giriş-sayfası-sayfa-1)
5. [Ölçüm Girişi](#5-ölçüm-girişi-sayfa-2)
6. [Özet ve Gönderim](#6-özet-ve-gönderim-sayfa-3)
7. [Fire Kaydet](#7-fire-kaydet-sayfa-4)
8. [Canlı İzleme](#8-canlı-i̇zleme--google-sheets)
9. [Yönetici — Ayarlar Sekmesi](#9-yönetici--ayarlar-sekmesi)
10. [Sık Sorulan Sorular](#10-sık-sorulan-sorular)

---

## 1. Sistem Hakkında

Enjeksiyon Kontrol, fabrikanın enjeksiyon makinelerine ait üretim ölçümlerini vardiya bazında kayıt altına alan, anlık fire takibi yapan ve tüm verileri Google Sheets'e ileten bir **Progressive Web App (PWA)**'dır.

**Neler yapılabilir?**
- Vardiya başı / ortası / sonu sayaç ölçümü girişi
- Tek veya çift enjeksiyon makinesiyle çalışma
- Anlık fire miktarı ekleme ve takibi
- Fire Kaydet sayfasıyla bağımsız fire günlüğü tutma
- Yöneticinin Google Sheets üzerinden gerçek zamanlı izleme yapması

**Teknik altyapı**
- Uygulama: GitHub Pages üzerinde tek sayfa (PWA)
- Veri tabanı: Google Sheets (Veriler, Fire Log, Canlı İzleme sekmeleri)
- Backend: Google Apps Script (JSONP API)

---

## 2. İlk Kurulum — Yönetici

> Bu adımlar **yalnızca bir kez** yapılır. Operatörler bu adımları yapmaz.

### 2.1 Google Sheets Hazırlama

1. [Google Sheets](https://sheets.google.com)'i açın, yeni bir çalışma kitabı oluşturun.
   - Önerilen ad: `Enjeksiyon Kontrol`
2. Aşağıdaki sekmeleri oluşturun (sekme adları birebir aynı olmalıdır):

| Sekme Adı | Açıklama |
|---|---|
| `Ayarlar` | Operatörler, şifreler, kasa boyutları, limitler |
| `Veriler` | Her gönderimin ham kaydı (otomatik oluşur) |
| `Fire Log` | Anlık fire kayıtları (otomatik oluşur) |
| `Canlı İzleme` | Vardiya bazlı anlık durum tablosu (elle oluşturulur) |

> `Veriler` ve `Fire Log` sekmeleri ilk form gönderiminde otomatik oluşur.  
> `Canlı İzleme` sekmesini elle boş olarak oluşturun — ilk ölçümde otomatik formatlanır.

### 2.2 Ayarlar Sekmesini Doldurma

`Ayarlar` sekmesini aşağıdaki şemaya göre doldurun:

| Sütun | İçerik | Örnek |
|---|---|---|
| **A** | Operatör adı soyadı | `Ali Veli` |
| **B** | Kasa ebatları (her satır bir ebat) | `30x40x14` |
| **C** | Operatör şifresi | `1234` |
| **D2** | Üretim limiti (uyarı eşiği, adet) | `2000` |
| **E** | Operatör ID numarası | `101` |
| **F2** | Maksimum anlık fire limiti | `50` |

**Örnek:**

```
     A           B          C     D     E    F
1  (başlık)   (başlık)   (...)  (...)  (...)
2  Ali Veli   30x40x14   1234   2000   101   50
3  Mehmet K.  40x60x20   5678          102
4  Ayşe D.    50x70x18   9012          103
```

> - A, C, E sütunları satır satır eşleştirilir (her satır bir operatör)
> - B sütunundaki kasa ebatları tüm operatörler için geçerlidir
> - D2 ve F2 tek bir hücre değeridir

### 2.3 Apps Script Deploy

1. Google Sheets menüsünden **Uzantılar → Apps Script** açın.
2. `Code.gs` dosyasını silin, yerine projedeki `Code.gs` dosyasının içeriğini yapıştırın.
3. **Kaydet** (💾 ikonu veya Ctrl+S).
4. Sağ üstten **Deploy → New deployment** tıklayın.
5. Ayarlar:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. **Deploy** tıklayın, oluşan URL'yi kopyalayın.
7. `index.html` dosyasını açın, `476. satırdaki` `SCRIPT_URL` değişkenini yeni URL ile değiştirin:
   ```javascript
   const SCRIPT_URL = 'https://script.google.com/macros/s/BURAYA_YENI_URL/exec';
   ```
8. Değişikliği kaydedin ve GitHub'a push edin.

> **Önemli:** Kod değişikliğinde yeni deployment oluşturun — aynı URL güncellenmez, yeni URL alırsınız ve `SCRIPT_URL`'yi tekrar güncellemeniz gerekir.

---

## 3. Telefona Kurulum — PWA

Uygulama normal bir web sitesi gibi çalışır, ancak telefona **uygulama olarak eklenebilir**. Böylece ana ekrandan açılır, tam ekran çalışır ve internet olmadan da önbellek sayesinde açılır.

### 3.1 iPhone / iPad (Safari)

1. **Safari** tarayıcısını açın (Chrome veya başka tarayıcı çalışmaz).
2. Uygulama adresini girin ve sayfayı yükleyin.
3. Alttaki araç çubuğundan **Paylaş** (⬆️ kutu-ok) ikonuna dokunun.
4. Aşağı kaydırın, **"Ana Ekrana Ekle"** seçeneğine dokunun.
5. Uygulama adını kontrol edin (`Ersan Plastik` olmalı), **"Ekle"** tuşuna basın.
6. Ana ekranda uygulama ikonu görünecektir.

> iPhone'da ilk açılışta **"Kameraya/Konumunuza erişmek istiyor"** gibi bir uyarı gelmez — izin gerekmez.

### 3.2 Android (Chrome)

1. **Chrome** tarayıcısını açın.
2. Uygulama adresini girin.
3. Adres çubuğunun sağındaki **⋮** (üç nokta) menüsüne dokunun.
4. **"Ana ekrana ekle"** veya **"Uygulamayı yükle"** seçeneğine dokunun.
5. **"Ekle"** veya **"Yükle"** ile onaylayın.
6. Ana ekranda ve uygulama listesinde görünür.

### 3.3 Bilgisayar (Chrome / Edge)

1. Tarayıcıda uygulamayı açın.
2. Adres çubuğunun sağındaki **⊕** (yükle) ikonuna tıklayın.
   - Yoksa: ⋮ menüsü → **"Ersan Plastik'i yükle"**
3. Masaüstünde veya başlat menüsünde kısayol oluşur.

---

## 4. Giriş Sayfası (Sayfa 1)

Uygulamayı her açtığınızda Giriş sayfası karşılar.

### Alanlar

| Alan | Açıklama |
|---|---|
| **Personel ID** | Size verilen numara (örn: `101`) |
| **Şifre** | Size verilen şifre |
| **Şifremi Hatırla** | İşaretlenirse şifre bu cihazda saklanır |
| **Vardiya** | SABAH / AKSAM / GECE — aktif olmayan vardiyalar soluk görünür |
| **Tarih** | Otomatik dolar, değiştirilemez |

### Adımlar

1. **Personel ID** alanına ID numaranızı girin → şifre alanı açılır.
2. Şifrenizi girin.
3. İstiyorsanız **Şifremi Hatırla**'yı işaretleyin.
4. Aktif vardiya butonuna dokunun.
5. **İleri** tuşuna basın.

> Vardiya saatleri:
> - **SABAH:** 07:00 – 15:00
> - **AKSAM:** 15:00 – 23:00
> - **GECE:** 23:00 – 07:00

---

## 5. Ölçüm Girişi (Sayfa 2)

Sayaç okumalarını ve üretim bilgilerini girdiğiniz sayfadır.

### Tek / Çift Enjeksiyon

- **Tek:** Bir makineden sorumlusanız → `Tek` butonuna basın (varsayılan).
- **Çift:** İki makineden aynı anda sorumlusanız → `Çift` butonuna basın.
  - Çift seçilince 2. makine için ayrı bir bölüm açılır.
  - Aynı makine iki kez seçilemez.

### Makine Seçimi

- Sarı butonlardan sorumlu olduğunuz **Enj No**'yu seçin.
- Seçim sonrası kasa, çevrim, ağırlık ve sayaç alanları açılır.

### Alanları Doldurma

| Alan | Açıklama |
|---|---|
| **Kasa** | Üretilen ürünün kalıp/kasa boyutu — listeden seçin |
| **Çevrim Süresi (sn)** | Bir çevrimin kaç saniye sürdüğü — sayısal tuş açılır |
| **Ağırlık (gr)** | Bir parçanın ağırlığı — ondalıklı tuş açılır |
| **Sayaç Başlama** | Ölçüm başındaki sayaç değeri |
| **Sayaç Bitiş** | Ölçüm bitişindeki sayaç değeri |
| **Fire** | Bu ölçüm dönemindeki fire adedi |

> **Sayaç Başlama:** Önceki ölçüm kaydınız varsa bu alan otomatik dolar ve **kilitlenir** (değiştirilemez). Bu, üretim şişirmesini önler.

> **Üretim hesabı** sayaç bitiş − başlama olarak otomatik gösterilir.
> - 2.000 üzeri → sarı uyarı
> - 4.000 üzeri → turuncu uyarı, gönderim engellenir

### Fire Girişi

- **+ / −** butonlarına basılı tutarak hızlı artırma/azaltma yapılabilir.
- Fire, **Ayarlar**'daki `maxFireLimit` değerini (varsayılan: 50) aşamaz.
- Negatif değer girilemez.

---

## 6. Özet ve Gönderim (Sayfa 3)

Girilen tüm bilgilerin özeti gösterilir. Hata varsa buradan görebilirsiniz.

### Onay Akışı

- **Üretim limit altında:** Doğrudan **Gönder** tıklanır.
- **Üretim limit üstünde:** Onay ekranı açılır.
  - `İptal` → forma dön, düzelt.
  - `Evet, Gönder` → kayıt yapılır.

### Gönderim Sonrası

- Başarılı kayıtta toast mesajı görünür:
  - 1. ölçüm: ✅ Ölçümünüz kaydedildi! İyi Günler
  - 2. ölçüm: ✅ 2. ölçüm kaydedildi!
  - 3. ölçüm: ✅ Vardiya tamamlandı!
- Sayfa otomatik olarak Giriş'e döner.

---

## 7. Fire Kaydet (Sayfa 4)

Ana form doldurulmadan, gün içinde istediğiniz zaman fire ekleyebileceğiniz bağımsız sayfadır.

> Alt navigasyon çubuğundaki **🔥 Fire** ikonuna dokunarak ulaşabilirsiniz.

### Giriş

İlk kullanımda kimlik doğrulaması gerekir:
1. **Personel ID** ve **şifre** girin.
2. **Vardiya** seçin.
3. **Giriş** yapın.

Aynı gün tekrar açıldığında bilgiler hatırlanır — sadece makinenizi ve fire miktarını girin.

### Tek / Çift Enjeksiyon

Ana formdaki gibi tek veya çift makine seçimi yapılabilir.

### Makine Seçimi ve Fire Ekleme

1. Sarı butonlardan makine no'nuzu seçin.
2. Fire miktarını girin veya **+ / −** butonlarıyla ayarlayın.
3. **Fire Ekle** tuşuna basın.

### Sahiplik Koruması

- Bir makinenin fire kaydını **ilk açan** kullanıcı o oturumun sahibi olur.
- Farklı kullanıcı aynı makinenin fire kaydına müdahale edemez.
- Vardiya değişince kilitler sıfırlanır.

### 15 Dakika Kilidi

Her fire eklemesinden sonra o makine **15 dakika kilitlenir**. Ekranda geri sayım görünür. Bu, kısa aralıklarla art arda fire girişini önler.

### Fire Geçmişi

Her makinenin altında o günkü fire girişlerinin listesi gösterilir (saat ve miktar).

---

## 8. Canlı İzleme — Google Sheets

Yöneticiler, Google Sheets'teki **Canlı İzleme** sekmesinden tüm makinelerin anlık durumunu görebilir.

### Tablo Yapısı

- **3 bölüm:** SABAH / AKSAM / GECE (her biri kendi rengiyle)
- **Her bölümde 12 satır:** Enjeksiyon 1 – 12
- **Toplam 36 sabit satır** — satır sayısı değişmez

### Renkler

| Vardiya | Renk |
|---|---|
| SABAH | Açık sarı |
| AKSAM | Açık mavi |
| GECE | Açık mor |

### Sütunlar

`Makine | Ad Soyad | Tarih | Kasa | Çevrim(sn) | Ağırlık(gr) | Üretim | Fire | Saat`

### Güncelleme Kuralı

- Her form gönderiminde ilgili **vardiya + makine** satırı üzerine yazılır.
- Aynı vardiyada birden fazla gönderim yapılırsa **Üretim ve Fire birikir** (toplanır).
- Yeni gün (farklı tarih) gelince o satır sıfırdan başlar.

**Örnek:**
> Enj1 SABAH 09:00 → 1.000 üretim  
> Enj1 SABAH 13:00 → 1.500 üretim  
> Enj1 SABAH 17:00 → 800 üretim  
> Canlı İzleme'de Enj1 SABAH satırı → **Üretim: 3.300**

### İlk Kurulumda

`Canlı İzleme` sekmesini boş bırakın. İlk ölçüm gönderiminde tablo başlıkları ve makine satırları otomatik oluşturulur.

---

## 9. Yönetici — Ayarlar Sekmesi

### Operatör Ekleme / Silme

1. `Ayarlar` sekmesini açın.
2. A sütununa operatör adını, C sütununa şifresini, E sütununa ID'sini yazın.
3. Değişiklik hemen aktif olur — uygulamayı yeniden yayınlamaya gerek yoktur.

### Kasa Boyutu Ekleme

- B sütununa yeni ebatı ekleyin (örn: `60x80x25`).
- Operatörler bir sonraki açılışta yeni ebatı görecektir.

### Limit Değiştirme

| Hücre | Değişken | Varsayılan |
|---|---|---|
| D2 | Üretim uyarı eşiği (adet) | 2000 |
| F2 | Maksimum anlık fire | 50 |

### Apps Script Güncelleme

`Code.gs` üzerinde değişiklik yapıldığında:
1. Apps Script editörünü açın.
2. Kodu güncelleyin, kaydedin.
3. **Deploy → Manage deployments** → mevcut deployment'ı **Edit** yapın.
4. Version: **New version** seçin → **Deploy**.
5. URL değişmez, aynı URL güncellenir.

---

## 10. Sık Sorulan Sorular

### "Saat yanlış gösteriyor"
Uygulama saati sunucudan (Google Apps Script) alır. Cihazınızın saatinin yanlış olması uygulamayı etkilemez. Sunucu saati otomatik senkronize edilir.

### "Vardiya butonu soluk, seçemiyorum"
Aktif vardiya saatinde değilsiniz. Saat kontrolünü yapın. Hata olduğunu düşünüyorsanız yöneticiye bildirin.

### "Sayaç başlama değerini değiştirmek istiyorum"
Önceki ölçüm kaydı varsa sayaç başlama alanı otomatik dolar ve kilitlenir. Bu kasıtlı bir güvenlik önlemidir — üretim manipülasyonunu engeller. Hata olduğunu düşünüyorsanız yöneticiye bildirin.

### "Uygulama kayıt yaptı ama Sheets'te göremiyorum"
- Google Sheets'i yenileyin.
- `Veriler` sekmesine bakın (yeni sekme `Canlı İzleme` değil).
- Apps Script'in deploy durumunu kontrol edin.

### "Fire ekliyorum ama 15 dakika kilidi açılmıyor"
Bu beklenen davranış. 15 dakika beklemeniz veya vardiya değişikliği olması gerekir. Ekranda kalan süre gösterilir.

### "Başka kullanıcı benim fire kaydıma müdahale edemedi"
Bu doğru. Fire kaydında **sahiplik koruması** vardır — bir makineye fire girilmeye başlandıktan sonra o oturumun sonuna kadar sadece aynı kullanıcı değişiklik yapabilir.

### "Telefon değiştirdim, uygulama ne olacak?"
Uygulama verilerini cihazda **yerel geçici önbellek** olarak tutar (draft, şifre hatırla). Asıl veriler Google Sheets'tedir. Yeni telefonunuza PWA'yı yeniden kurun, aynı şekilde kullanmaya devam edin.

### "Yanlış ölçüm gönderdim"
Uygulama üzerinden düzeltme yapılamaz. Yöneticinin Google Sheets `Veriler` sekmesinden ilgili satırı düzeltmesi veya silmesi gerekir.

---

*Ersan Plastik — Enjeksiyon Kontrol Sistemi*  
*Sorun bildirimi için yöneticinizle iletişime geçin.*
