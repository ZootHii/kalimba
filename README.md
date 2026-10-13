# Kalimba

iPhone Safari için hazırlanmış, başparmakla dokunarak veya tuşların üzerinden kaydırarak çalınabilen 17 tuşlu kalimba.

## iPhone'da aynı Wi-Fi üzerinden açma

1. Bu klasörde bir terminal açıp yerel sunucuyu başlat:

   ```sh
   python3 -m http.server 5858 --bind 0.0.0.0
   ```

2. Mac'in yerel ağ adresini bul:

   ```sh
   ipconfig getifaddr en0
   ```

3. iPhone'u Mac ile aynı Wi-Fi ağına bağla ve Safari'de `http://MAC_IP_ADRESI:5858` adresini aç. Terminaldeki sunucu açık kalmalı.

İlk yüklemede ses dosyaları hazırlanır. Durum göstergesi **Çalmaya hazır** olduktan sonra tuşlara dokunabilir veya parmağını tuşların üzerinden kaydırabilirsin.

## Ses kayıtları

`assets/audio/` içindeki sekiz WAV dosyası FreePats Kalimba sound bank sürüm 2019-07-23'ten alınmıştır. Dosyalar gerçek kalimba kayıtlarıdır ve CC0 1.0 kamu malı tahsisi altında yayımlanmıştır. Kaynak ve lisans bilgisi [assets/audio/LICENSE.md](assets/audio/LICENSE.md) dosyasındadır. Ses bankasının SFZ nota bölgeleri ve ince akort değerleri `app.js` içindeki `SAMPLE_REGIONS` tablosuna aktarılmıştır.
