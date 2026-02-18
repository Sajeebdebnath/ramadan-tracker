const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        onMounted(() => {
            if (window.lucide) lucide.createIcons();
        });

        // Data is loaded from data.js via window object
        const scheduleData = window.scheduleData || [];
        const duas = window.duas || {};

        const now = ref(new Date());
        const schedule = ref(scheduleData);
        const showSchedule = ref(false);

        onMounted(() => {
            setInterval(() => {
                now.value = new Date();
            }, 1000);
        });

        const toBanglaNum = (num) => {
            if (!num) return "";
            const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
            return num.toString().split('').map(c =>
                /[0-9]/.test(c) ? banglaDigits[parseInt(c)] : c
            ).join('');
        };

        const toBanglaTime = (timeStr) => {
            let formatted = toBanglaNum(timeStr);
            if (timeStr.includes('AM')) {
                return formatted.replace('AM', '') + ' ';
            } else if (timeStr.includes('PM')) {
                return formatted.replace('PM', '') + ' ';
            }
            return formatted;
        };

        const currentDateDisplay = computed(() => {
            const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
            const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

            const d = now.value;
            const dayName = days[d.getDay()];
            const dateNum = toBanglaNum(d.getDate());
            const monthName = months[d.getMonth()];
            const yearNum = toBanglaNum(d.getFullYear());

            return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
        });

        const currentDaySchedule = computed(() => {
            const todayStr = now.value.toISOString().split('T')[0];
            return schedule.value.find(s => s.fullDate === todayStr) || null;
        });

        const nextDaySchedule = computed(() => {
            const tomorrow = new Date(now.value);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tmrwStr = tomorrow.toISOString().split('T')[0];
            return schedule.value.find(s => s.fullDate === tmrwStr) || null;
        });

        const getEventTime = (dateStr, timeStr) => {
            return new Date(`${dateStr}T${timeStr}:00`);
        };

        const computedState = computed(() => {
            if (!currentDaySchedule.value) {
                const firstDay = schedule.value[0];
                const lastDay = schedule.value[schedule.value.length - 1];
                
                if (!firstDay || !lastDay) return { type: 'unknown', target: null };

                const firstDate = new Date(`${firstDay.fullDate}T00:00:00`);
                const lastDate = new Date(`${lastDay.fullDate}T23:59:59`);

                if (now.value < firstDate) return { type: 'pre_ramadan', target: firstDate };
                if (now.value > lastDate) return { type: 'eid', target: null };

                return { type: 'unknown', target: null };
            }

            const today = currentDaySchedule.value;
            const sehriTime = getEventTime(today.fullDate, today.sehri);
            const iftarTime = getEventTime(today.fullDate, today.iftar);

            if (now.value < sehriTime) {
                return { type: 'sehri', target: sehriTime, label: 'সেহরির শেষ হতে বাকি' };
            }

            if (now.value >= sehriTime && now.value < iftarTime) {
                return { type: 'iftar', target: iftarTime, label: 'ইফতারের বাকি' };
            }

            if (now.value >= iftarTime) {
                if (nextDaySchedule.value) {
                    const nextSehri = getEventTime(nextDaySchedule.value.fullDate, nextDaySchedule.value.sehri);
                    return { type: 'next_sehri', target: nextSehri, label: 'সেহরির শেষ হতে বাকি' };
                } else {
                    return { type: 'eid', target: null };
                }
            }

            return { type: 'unknown' };
        });

        const timeLeft = computed(() => {
            if (!computedState.value.target) return "00:00:00";

            const diff = computedState.value.target - now.value;
            if (diff < 0) return "00:00:00";

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        });

        const ramadanDay = computed(() => {
            if (currentDaySchedule.value) return currentDaySchedule.value.ramadan;
            if (computedState.value.type === 'next_sehri' && nextDaySchedule.value) {
                return nextDaySchedule.value.ramadan;
            }
            return 0;
        });

        const currentStateLabel = computed(() => {
            if (computedState.value.type === 'pre_ramadan') return 'শিঘ্রই আসছে';
            if (computedState.value.type === 'eid') return 'ঈদ মোবারক';
            return 'রমজান';
        });

        const statusText = computed(() => {
            const map = {
                'pre_ramadan': 'রমজান শুরু হতে বাকি',
                'sehri': 'সেহরির শেষ সময় বাকি',
                'iftar': 'ইফতারের সময় বাকি',
                'next_sehri': 'সেহরির শেষ সময় বাকি (আগামীকাল)',
                'eid': 'ঈদ মোবারক',
                'unknown': 'লোড হচ্ছে...'
            };
            return map[computedState.value.type];
        });

        const nextEventTime = computed(() => {
            if (computedState.value.target) {
                const d = computedState.value.target;
                return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            }
            return "--:--";
        });

        const nextEventLabel = computed(() => computedState.value.label || 'সময়');

        const currentDua = computed(() => {
            if (computedState.value.type === 'sehri' || computedState.value.type === 'next_sehri') {
                return duas.sehri || {};
            }
            return duas.iftar || {};
        });

        const currentDuaTitle = computed(() => {
            if (computedState.value.type === 'sehri' || computedState.value.type === 'next_sehri') {
                return duas.sehri ? duas.sehri.title : '';
            }
            return duas.iftar ? duas.iftar.title : '';
        });

        const formatTime12 = (time24) => {
            if (!time24) return "";
            let [h, m] = time24.split(':');
            h = parseInt(h);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            return `${h}:${m} ${ampm}`;
        };

        const toggleSchedule = () => {
            showSchedule.value = !showSchedule.value;
            nextTick(() => {
                if (window.lucide) lucide.createIcons();
            });
        };

        return {
            now,
            schedule,
            showSchedule,
            toggleSchedule,
            currentDateDisplay,
            ramadanDay,
            timeLeft,
            statusText,
            currentStateLabel,
            nextEventTime,
            nextEventLabel,
            currentDua,
            currentDuaTitle,
            formatTime12,
            toBanglaNum,
            toBanglaTime,
            computedState
        };
    }
}).mount('#app');
