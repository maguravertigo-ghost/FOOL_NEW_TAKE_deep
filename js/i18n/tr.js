// js/i18n/tr.js — полный турецкий словарь
export const TR = {
  // ---- Main menu ----
  'menu.games':           'OYNANAN OYUN:',
  'menu.wins':            'KAZANMA:',
  'menu.losses':          'KAYIP:',
  'menu.draws':           'BERABERE:',
  'menu.stylePoints':     'STİL PUANI:',
  'menu.help':            'NASIL OYNANIR',
  'menu.settings':        'AYARLAR',
  'menu.about':           'HAKKINDA',
  'menu.shop':            'DÜKKAN',
  'menu.style':           'STİL',
  'menu.quest':           'GÖREV',
  'menu.language':        'Dil',
  'menu.fullscreen':      'Tam ekran',
  'menu.author':          'segurakaa',

  // ---- Language overlay ----
  'lang.title':           'DİL SEÇİMİ',
  'lang.ru':              'Русский',
  'lang.en':              'English',
  'lang.tr':              'Türkçe',
  'lang.close':           'KAPAT',

  // ---- Dialogs ----
  'dialog.ok':            'TAMAM',
  'dialog.cancel':        'İptal',
  'dialog.yes':           'Evet',

  // ---- About ----
  'about.text1':          '<b>Aptal oyunu</b> — Rus kart oyunu klasiği.',
  'about.text2':          'Kod ve tasarım yazarı: <b>Segura Kaa</b>',
  'about.text3':          '2024 ©',
  'about.close':          'MENÜYE',

  // ---- Settings ----
  'settings.title':       'AYARLAR',
  'settings.sfx':         'Ses efektleri',
  'settings.music':       'Oyun müziği',
  'settings.deckSize':    'Destedeki kart',
  'settings.handLayout':  'Eldeki kartlar',
  'settings.moveHints':   'Hamle ipuçları',
  'settings.showDeckCounter': 'Deste sayacı',
  'settings.aiLevel':     'Yapay zeka seviyesi',
  'settings.on':          'açık',
  'settings.off':         'kapalı',
  'settings.fan':         'yelpaze',
  'settings.straight':    'düz',
  'settings.aiNovice':    'çaylak',
  'settings.aiNormal':    'normal',
  'settings.aiExpert':    'uzman',
  'settings.close':       'MENÜYE',

  // ---- Shop ----
  'shop.categories':      'KATEGORİ SEÇ',
  'shop.showcase':        'VİTRİN',
  'shop.balance':         'STİL PUANI',
  'shop.back':            'GERİ',
  'shop.menu':            'MENÜYE',
  'shop.cat.shirt':       'KART ARKALARI',
  'shop.cat.design':      'KART TASARIMI',
  'shop.cat.suits':       'RENKLER',
  'shop.cat.table':       'MASA',
  'shop.cat.decor':       'DEKORASYONLAR',
  'shop.item.shirt':      'Arka',
  'shop.item.table':      'Masa',
  'shop.item.decor':      'Dekor',
  'shop.item.design.grid':           'Izgara',
  'shop.item.design.center':         'Merkez',
  'shop.item.design.rank':           'Değer+Renk',
  'shop.item.design.rankNoCorners':  'Sadece merkez',
  'shop.buy.title':       'Satın Alma',
  'shop.buy.question':    '<b>{label}</b> öğesini <b class="mm-stat-value--accent">{price}</b> stil puanına satın almak istiyor musunuz?',
  'shop.buy.noMoney':     'Yeterli stil puanı yok.',
  'shop.buy.already':     'Zaten sahipsiniz.',
  'shop.welcome.title':   'Hoş geldiniz!',
  'shop.welcome.text':    "<b>Joker'in Dükkanı</b>'na hoş geldiniz — oyununuzu daha parlak ve güzel yapacak çok şey var. Oyununuza kendi benzersiz tarzınızı verin!",
  'shop.welcome.checkbox':'Bir daha gösterme',
  'shop.welcome.ok':      'TAMAM',

  // ---- Style ----
  'style.title':          'STİL KOLEKSİYONU',
  'style.tab.shirt':      'KART ARKASI',
  'style.tab.design':     'KART TASARIMI',
  'style.tab.suits':      'RENKLER',
  'style.tab.table':      'MASA',
  'style.tab.decor':      'DEKORASYONLAR',
  'style.preview':        'STİLİ ÖNİZLE',
  'style.close':          'MENÜYE',
  'style.locked.title':   'Kilitli',
  'style.locked.message': "Bu öğeyi Joker'in Dükkanı'ndan satın almak için maçlarda stil puanı kazanın ve görevleri tamamlayın.",
  'style.preview.loading':'Düzen oluşturuluyor…',
  'style.preview.back':   'dönmek için dokunun',

  // ---- Quest ----
  'quest.title':          'GÖREV',
  'quest.claim':          'ÖDÜLÜ AL',
  'quest.close':          'MENÜYE',
  'quest.reset':          'GÖREVİ BİTİR',
  'quest.resetTitle':     'Görevi bitir?',
  'quest.resetConfirm':   'Görevi bitir? İlerleme ve puanlar kaybolacak.',
  'quest.claimed':        'alındı',
  'quest.notDone':        'tamamlanmadı',
  'quest.headerClassic':  'MOD: KLASİK (36)',
  'quest.headerTrial':    'MOD: SINAV (52)',
  'quest.hintClassic':    'Sınavı açmak için tüm klasik görevleri tamamlayın.',
  'quest.reward.title':   'Ödül',
  'quest.reward.received':'<b class="mm-stat-value--accent">{n}</b> stil puanı alındı.',
  'quest.reward.none':    'Ödül almak için en az bir görevi tamamlayın.',
  'quest.reward.allClaimed': 'Tüm mevcut ödüller zaten alındı.',
  'quest.reward.nothing': 'Henüz alınacak bir şey yok.',
  'quest.trial.title':    'Sınav açıldı!',
  'quest.trial.text':     "<b>Tüm Klasik görevleri</b> tamamladınız!<br><br>Yeni bir mod açıldı — <b>Sınav</b>. Tam <b>52 kartlık</b> desteyle oynuyorsunuz.<br><br><b>Ayarlar</b>'dan etkinleştirmeyi unutmayın.",

  // ---- In-game: player action button ----
  'game.btn.pass':        'PAS',
  'game.btn.take':        'ALIYORUM',
  'game.btn.myTurn':      'BENİM SIRAM',
  'game.btn.pogony':      'APOLETLER!',
  'game.btn.vsyo':        'HEPSİ!',

  // ---- In-game: Joker phrases ----
  'game.ai.yourTurn':     'Senin sıran',
  'game.ai.defended':     'Savundun! Ekle',
  'game.ai.take':         'Alıyorum, ekle',
  'game.ai.defend':       'Savun!',
  'game.ai.cantBeat':     'Kıramazsın — al',
  'game.cpu.phrases.0':   'Benim sıram',
  'game.cpu.phrases.1':   'Benim hamlem',
  'game.cpu.phrases.2':   'Ben oynuyorum',
  'game.cpu.phrases.3':   'Sıra bende',
  'game.cpu.phrases.4':   'Şimdi ben',
  'game.cpu.phrases.5':   'Dayan bakalım!',

  // ---- In-game: finish labels ----
  'game.finish.win':      'ZAFER',
  'game.finish.lose':     'YENİLGİ',
  'game.finish.draw':     'BERABERE',
  'game.finish.pogony':   'APOLETLER!',
  'game.finish.vsyo':     'HEPSİ!',

  // ---- Game over screen ----
  'game.over.win':        'Zafer!',
  'game.over.lose':       'Yenilgi',
  'game.over.draw':       'Berabere',
  'game.over.winSub':     'Joker kartlarla kaldı',
  'game.over.loseSub':    'Kartlarla kalan sizsiniz',
  'game.over.epi1':       '🎖️ Bir apolet! +250',
  'game.over.epi2':       '🎖️🎖️ İki apolet! +250',
  'game.over.epi3':       '🎖️🎖️ 👔 Apoletler ve kravat! +250',
  'game.over.questDone':  '«{rank}» görevi tamamlandı — ödülünüzü alın',
  'game.over.points':     'Kazanılan stil puanı: <b>{n}</b>',
  'game.over.ad':         '📺 Reklam izle, +500 puan al',
  'game.over.adLoading':  '⏳ Reklam yükleniyor…',
  'game.over.adDone':     '✓ +500 alındı',
  'game.over.adRewardTitle': 'Ödül',
  'game.over.adRewardText':  '+500 stil puanı!',
  'game.over.adTitle':    'Reklam',
  'game.over.adNoConnTitle': 'Bağlantı kesildi',
  'game.over.adNoNet':    'İnternet bağlantısı yok.<br><br>İnternete bağlanın ve tekrar deneyin.',
  'game.over.adTimeout':  'Bağlantı kesildi.<br><br>İnternete bağlanın ve oyunu yeniden başlatın.',
  'game.over.adError':    'Reklam kullanılamıyor.<br><br>İnternet bağlantınızı kontrol edin.',
  'game.over.replay':     'TEKRAR OYNA',
  'game.over.menu':       'MENÜYE ÇIK',

  // ---- First win dialog ----
  'game.firstWin.title':  'Tebrikler!',
  'game.firstWin.text':   '<b>İlk stil puanlarınızı</b> kazandınız!<br><br>Şimdi <b>Joker\'in Dükkanı</b>\'nı ziyaret edebilirsiniz — yeni kart arkaları, masalar, dekorasyonlar ve kart tasarımları sizi bekliyor. Oyununuza kendi tarzınızı verin!',

  // ---- Gift expired ----
  'game.giftExpired.title': 'Hediye süresi doldu',
  'game.giftExpired.text':  'Joker\'in hediyesi sona erdi.<br><br>Tasarımı beğendiniz mi? <b>Joker\'in Dükkanı</b>\'ndan stil puanıyla satın alabilirsiniz — daha çok seçenek var.',

  // ---- Pause overlay ----
  'pause.title':          'DURAKLATILDI',
  'pause.volume':         'SES',
  'pause.resume':         'Oyuna devam et',
  'pause.exit':           'Ana menüye çık',

  // ---- Coin toss ----
  'coin.tossTitle':       'KURA ÇEKİMİ',
  'coin.firstMoveCpu':    'İLK HAMLE: JOKER',
  'coin.firstMovePlayer': 'İLK HAMLE: OYUNCU',

  // ---- Gift dialog ----
  'gift.title':           'SİZE BİR HEDİYE!',
  'gift.text':            'Joker size <b>3 maç boyunca geçerli bir oda tasarımı</b> hediye ediyor.',
  'gift.hint':            'Detaylar: ANA MENÜ → STİL',
  'gift.ok':              'TAMAM',

  // ---- Help ----
  'help.title':           'YARDIM',
  'help.scrollUp':        'Yukarı kaydır',
  'help.scrollDown':      'Aşağı kaydır',
  'help.close':           'MENÜYE',

  'help.intro':           '<b>Fool</b> — Joker\'e karşı Durak kart oyunu. Maçları kazanın, görevleri tamamlayın, stil puanı kazanın ve yeni oyun dekorasyonlarını açın.',

  'help.goal.title':      'Oyunun amacı',
  'help.goal.text':       'Tüm kartlarınızı rakibinizden önce atın. Kartlarla kalan «aptal»dır. Her oyuncuya 6 kart dağıtılır. Deste en üstteki kart koz olur.',

  'help.start.title':     'Maç başlangıcı',
  'help.start.text':      'Her maç öncesinde kimin önce oynayacağı belirlenir.<br>• Birinde <b>aptal jetonu</b> varsa (önceki maçın kaybedenine verilir) — <b>jetonu olmayan</b> önce oynar.<br>• Kimsede yoksa — örneğin ilk maçta veya beraberlikten sonra — <b>kura çekilir</b>: Joker\'in parası atılır. Kazanan taraf önce oynar.<br><br>Deste karıştırılır, her oyuncuya <b>6 kart</b> dağıtılır. Kartları önce oynayacak olan alır. Deste en üstteki kart açılır — rengi <b>koz</b> olur ve kart destenin altına kapalı şekilde konur. Bu kart desteden <b>en son</b> çıkar.<br><br>Oyuncu şu şekilde hareket eder:<br>• <b>Saldır / savun / aktar</b> — elinizden bir kart seçin ve masadaki vurgulanmış bir yuvaya koyun.<br>• <b>Pas / Alıyorum / Apoletler! / Hepsi!</b> — sağdaki <b>oyuncu düğmesine</b> basın. Üzerinde her zaman mevcut eylem yazar.<br>Tur, tüm kartlar kırıldığında veya savunan masa aldığında otomatik biter.',

  'help.flow.title':      'Oyun akışı',
  'help.flow.text':       '<b>Saldırı.</b> İlk oyuncu kart koyar — saldırır.<br><b>Savunma.</b> İkinci oyuncu kartı daha yüksek aynı renk veya herhangi bir kozla kırmalıdır (saldırı kartı koz değilse). Koz kartı sadece daha yüksek bir kozla kırılır.<br><b>Ekleme.</b> Tüm kartlar kırıldıktan sonra saldıran, masadakiyle aynı değerde kart ekleyebilir.<br><b>Alma.</b> Kıramazsa — savunan tüm masayı alır.<br><b>Koz.</b> Herhangi bir koz olmayan kartı kırar. Koz sadece daha yüksek bir kozla kırılır.',

  'help.modes.title':     'Oyun modları',
  'help.modes.text':      '<b>Podkidnoy.</b> Klasik mod. Savunan sadece kırar veya alır.<br><b>Perevodnoy.</b> İlk kırılan karttan önce savunan saldırıyı saldırana aktarabilir — aynı değerde bir kart koyarak. Roller değişir.',

  'help.toss.title':      'Kura çekimi — Joker\'in parası',
  'help.toss.cpuLabel':   'Joker<br>ilk oynar',
  'help.toss.playerLabel':'Oyuncu<br>ilk oynar',
  'help.toss.text':       'En ilk maçta (ve her beraberlikten sonra) kura çekilir. Para kimin ilk oynayacağını ve kartları önce alacağını belirler.',

  'help.token.title':     'Aptal jetonu',
  'help.token.text':      'Maçı kaybeden <b>aptal jetonunu</b> alır. Tüm sonraki maçlarda jeton sahibi kartları ikinci alır, rakip önce oynar. Beraberlikte jeton atılır ve bir sonraki maç tekrar kurayla başlar.<br><br>Jeton ana menüde mod düğmesinde (oyuncu aptalsa) veya pencerelerde Joker\'in üzerinde (AI aptalsa) görünür. Ayrıca maçın başında jeton önceki kaybedene geçer.',

  'help.epi.title':       'Apoletler ve kravat',
  'help.epi.text':        'Bir maçı arka arkaya aynı değerde birkaç kart atarak bitirirseniz Joker\'e «apolet takarsınız»:<br><br>• 1 kart → <b>1 apolet</b><br>• 2 kart → <b>2 apolet</b><br>• 3+ kart → <b>2 apolet + kravat</b><br><br>Apoletler için <b>stil puanı</b> verilir. Olay sadece oyuncu son turda <b>APOLETLER!</b> düğmesine kendisi basarsa tetiklenir.',

  'help.points.title':    'Stil puanları',
  'help.points.text':     'Oyunun iç para birimi. Şu şekilde kazanılır:<br><br>• <b>100</b> — zafer için<br>• <b>+50/+100/+250/+500</b> — apoletler için<br>• <b>250 + 50×N</b> — görev için (N — ilerleme)<br><br><b>Joker\'in Dükkanı</b>\'nda oyun dekorasyonları için harcanır.',

  'help.quest.title':     'Görev',
  'help.quest.text':      'Her görev maddesi ayrı bir <b>kart değeridir</b> (6, 7, 8, … A). Tüm görevler hemen açıktır, herhangi bir sırayla tamamlanabilir.<br><br>Bir görevi ilerletmek için maçı <b>apoletlerle</b> bitirmelisiniz: son turda <b>APOLETLER!</b> düğmesine basarak o değerde bir veya daha fazla kart atın.<br><br>• <b>1 kart</b> tek değer → ilerleme 1<br>• <b>2 kart</b> → ilerleme 2<br>• <b>3 kart</b> → ilerleme 3<br>• <b>4 kart</b> → ilerleme 4 (maksimum)<br><br>Her ilerleme seviyesi için <b>ek stil puanı</b> verilir — aynı anda ne kadar çok aynı değerde kart attıysanız ödül o kadar yüksek.<br><br>Tüm klasik görevler (6–A) tamamlandığında <b>Sınav</b> açılır — <b>2, 3, 4, 5</b> değerleri için görevler eklenir. Bunlar sadece <b>52 kartlık</b> desteyle tamamlanabilir, <b>Ayarlar</b>\'da açılır. Sınavın diğer görevleri 36 kartlık desteyle de tamamlanabilir.<br><br>Menüdeki <b>GÖREV</b> düğmesindeki rozet, alınmamış ödüller olduğu anlamına gelir.',

  'help.shop.title':      'Dükkan ve Stil',
  'help.shop.text':       '<b>Dükkan</b>\'da kart arkaları, <b>kart tasarımları</b> (ön yüz stilleri), renkler, masalar ve dekorasyonlar satılır. Kategoriler, satın alabileceğiniz bir ürün varsa yeşil renkte vurgulanır.<br><br>Satın alınan öğeler <b>STİL</b> bölümünde görünür — burada bunları mevcut oyun odası görünümüne (maça) uygulayabilirsiniz.',

  'help.badges.title':    'Menüdeki rozetler',
  'help.badges.text':     'STİL\'deki bir döşemede <b>NEW</b> — öğe satın alınmış ama henüz açılmamış. Üzerine tıklayın — rozet kaybolur. Menüdeki STİL düğmesinde NEW rozeti varsa görülmemiş öğeler vardır.<br><br>GÖREV düğmesindeki <b>fiş</b> — alınmamış ödüller.',

  'help.settings.title':  'Ayarlar',
  'help.settings.text':   '• <b>Ses ve müzik</b> — açık/kapalı.<br>• <b>Destedeki kart</b> — 36 veya 52 kart.<br>• <b>Eldeki kartlar</b> — yelpaze veya düz çizgi.<br>• <b>Hamle ipuçları</b> — geçersiz kartlarda kırmızı işaretler.<br>• <b>Deste sayacı</b> — destede kalan kart sayısı.<br>• <b>AI seviyesi</b> — çaylak / normal / uzman.',

  'help.pause.title':     'Ses ve duraklatma',
  'help.pause.text':      'Maç sırasında müzik ve ses seviyesi <b>DURAKLAT</b> penceresinden ayarlanır — sahnenin sol üst köşesindeki duraklatma düğmesi (medya oynatıcılardaki gibi iki dikey çubuk) veya <b>Esc</b> tuşu ile açılır. Burada ayrıca «Oyuna devam et» ve «Ana menüye çık» vardır.<br><br>Ana menüde sesler ve müzik tamamen <b>AYARLAR</b>\'dan kapatılabilir.',

  'help.mouse.title':     'Kontroller — fare ve dokunma',
  'help.mouse.text':      '<b>Kart seçimi.</b> Elinizdeki bir karta tıklayın / dokunun — kart kalkar ve uygun masa yuvaları vurgulanır.<br><b>Oynama.</b> Vurgulanan yuvaya tıklayın — kart oraya uçar. Karta tekrar tıklayın — seçimi kaldır.<br><b>Oyuncu düğmesi.</b> Sağ altta — <b>ALIYORUM</b>, <b>PAS</b>, <b>APOLETLER!</b>, <b>HEPSİ!</b> veya <b>BENİM SIRAM</b>.<br><b>Duraklat.</b> Sahnenin sol üst köşesindeki duraklatma düğmesi (iki dikey çubuk).',

  'help.kb.title':        'Kontroller — klavye (maçta)',
  'help.kb.text':         '• <b>←</b> / <b>→</b> — eldeki kartlar arasında geçiş. Elin kenarında ok, odağı <b>oyuncu düğmesine</b> taşır — ve ilk karta geri.<br>• <b>↑</b> — karttan <b>masaya</b> geç: mevcut yuvalar vurgulanır (kır / aktar / ekle). Tekrar basınca bir sonraki yuva.<br>• <b>↓</b> — <b>oyuncu düğmesine</b> hızlı geçiş (masadan — karta geri).<br>• <b>Enter</b> — seçili kartı vurgulanan yuvaya oyna veya oyuncu düğmesine bas.<br>• <b>Backspace</b> — kart seçimini kaldır.<br>• <b>Esc</b> — duraklat / pencereyi kapat.<br><br><b>Menülerde ve pencerelerde:</b><br>• <b>Oklar</b> — düğmeler arasında gezin.<br>• <b>Enter</b> / <b>Space</b> — odaklanan düğmeye bas.<br>• <b>Esc</b> — pencereyi kapat / menüye dön.',

  'help.tv.title':        'Kontroller — TV kumandası',
  'help.tv.text':         'Oyun kumandadan <b>oklar + OK</b> için tasarlanmıştır. Doğru çalıştığında — düğmeler, kartlar ve yuvalar arasındaki gezinme klavyedekiyle aynıdır.<br><br><b>Android TV\'de neden imleç dairesi görünür.</b> TV tarayıcısı genellikle <b>sanal fare</b> modunda çalışır: D-pad imleci hareket ettirir ve ok tuşlarının basışlarını sayfaya iletmez. Bu modda oyunumuz olayları almaz — bu yüzden kontroller «çalışmaz».<br><br><b>Kumandayı D-pad moduna nasıl geçiririm:</b><br>• Çoğu TV\'de kumandada <b>«işaretçi»</b> veya <b>«dpad»</b> düğmesi vardır — «imleç ↔ oklar» modlarını değiştirir.<br>• Android TV / Google TV: kumanda ayarları — «işaretçi / D-pad» geçişi. Bazen D-pad merkez düğmesini uzun basmak yeterlidir.<br>• Samsung / LG: <b>Return / Back</b> düğmesi imleç modundan çıkarır.<br>• Apple TV: Siri Remote kaydırma kullanır; <b>Menu</b> düğmesi tarayıcıda D-pad\'i etkinleştirmeye yardımcı olur.<br><br><b>Geçiş sonrası:</b><br>• <b>Oklar</b> — düğmeler ve kartlar arasında gezinme.<br>• <b>OK / Enter</b> — bas.<br>• <b>Back</b> — oyun sırasında duraklat, menüde pencereyi kapat.',

  // ---- Fullscreen ----
  'fullscreen.enter':     'Tam ekran',
  'fullscreen.exit':      'Tam ekrandan çık',
  'fullscreen.error':     'Tarayıcı tam ekran modunu değiştirmeye izin vermedi. <b>F11</b> tuşuna basın veya tarayıcı menüsünü kullanın.',
};