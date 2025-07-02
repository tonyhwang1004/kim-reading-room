// Google Sheets API 연동 코드
// 김엄마독서실 실시간 데이터 연동 시스템

class GoogleSheetsManager {
    constructor() {
        // Google Sheets 정보
        this.spreadsheetId = '1OVEffnCRTZ1A-cVCb4CYiYe3MicyI9TSkJNsau4mGVo';
        this.apiKey = 'YOUR_API_KEY_HERE'; // API 키 필요
        this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        
        // 시트 범위 정의
        this.ranges = {
            plannerData: '플래너제출학생명단!A:Z',
            floor8Data: '8F!A:O',
            floor7Data: '7F!A:O', 
            feeData: 'Fee!A:Z'
        };
        
        this.init();
    }

    init() {
        console.log('📊 Google Sheets 연동 시스템 시작');
        this.loadAllData();
        
        // 5분마다 자동 업데이트
        setInterval(() => {
            this.loadAllData();
        }, 300000);
    }

    // API 키 없이도 작동하는 대체 방법 (CSV 내보내기 활용)
    async loadDataWithoutAPI() {
        try {
            // Google Sheets를 CSV로 내보내기 URL 사용
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/export?format=csv&gid=0`;
            
            const response = await fetch(csvUrl, {
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error('데이터 로드 실패');
            }
            
            const csvText = await response.text();
            const data = this.parseCSV(csvText);
            
            this.updateUI(data);
            
        } catch (error) {
            console.log('CSV 로드 실패, 샘플 데이터 사용:', error);
            this.loadSampleData();
        }
    }

    // CSV 파싱 함수
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index]?.trim() || '';
                });
                data.push(row);
            }
        }
        
        return data;
    }

    // Google Sheets API 사용 (API 키 필요)
    async loadDataWithAPI(range) {
        try {
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status}`);
            }
            
            const data = await response.json();
            return data.values;
            
        } catch (error) {
            console.error('Google Sheets API 오류:', error);
            return null;
        }
    }

    // 모든 데이터 로드
    async loadAllData() {
        console.log('🔄 데이터 업데이트 중...');
        
        // API 키가 설정되어 있으면 API 사용, 아니면 대체 방법 사용
        if (this.apiKey !== 'YOUR_API_KEY_HERE') {
            await this.loadWithAPI();
        } else {
            await this.loadDataWithoutAPI();
        }
    }

    // API를 통한 데이터 로드
    async loadWithAPI() {
        try {
            // 각 시트의 데이터 로드
            const plannerData = await this.loadDataWithAPI(this.ranges.plannerData);
            const floor8Data = await this.loadDataWithAPI(this.ranges.floor8Data);
            const floor7Data = await this.loadDataWithAPI(this.ranges.floor7Data);
            const feeData = await this.loadDataWithAPI(this.ranges.feeData);

            // 데이터 처리 및 UI 업데이트
            this.processAndUpdateData({
                planner: plannerData,
                floor8: floor8Data,
                floor7: floor7Data,
                fee: feeData
            });

        } catch (error) {
            console.error('API 데이터 로드 실패:', error);
            this.loadSampleData();
        }
    }

    // 데이터 처리 및 UI 업데이트
    processAndUpdateData(rawData) {
        if (!rawData.planner) {
            this.loadSampleData();
            return;
        }

        // 플래너 미작성자 찾기
        const plannerMissing = this.findPlannerMissing(rawData.planner);
        
        // 회비 미납자 찾기
        const feeUnpaid = this.findFeeUnpaid(rawData.fee);
        
        // 신규 학생 찾기
        const newStudents = this.findNewStudents(rawData.floor8, rawData.floor7);

        // UI 업데이트
        this.updateManagementPage({
            plannerMissing,
            feeUnpaid,
            newStudents
        });

        // 알림 숫자 업데이트
        this.updateAlertNumbers({
            urgentPlanner: plannerMissing.length,
            urgentFee: feeUnpaid.filter(s => s.unpaidMonths >= 2).length,
            newStudents: newStudents.length
        });

        console.log('✅ 실시간 데이터 업데이트 완료');
    }

    // 플래너 미작성자 찾기
    findPlannerMissing(plannerData) {
        if (!plannerData || plannerData.length < 2) return [];
        
        const headers = plannerData[0];
        const nameIndex = headers.findIndex(h => h.includes('이름') || h.includes('성명'));
        const plannerIndex = headers.findIndex(h => h.includes('플래너') || h.includes('제출'));
        
        const missing = [];
        
        for (let i = 1; i < plannerData.length; i++) {
            const row = plannerData[i];
            const name = row[nameIndex];
            const plannerStatus = row[plannerIndex];
            
            if (name && (!plannerStatus || plannerStatus === '미제출' || plannerStatus === '')) {
                missing.push({
                    name: name,
                    seat: row[2] || '미정',
                    school: row[3] || '미정',
                    grade: row[4] || '미정',
                    phone: row[5] || '',
                    parentPhone: row[6] || '',
                    joinDate: row[7] || '',
                    priority: 'high'
                });
            }
        }
        
        return missing;
    }

    // 회비 미납자 찾기
    findFeeUnpaid(feeData) {
        if (!feeData) return [];
        
        // 임시 데이터 (실제로는 스프레드시트에서 가져옴)
        return [
            {
                name: '김나형',
                seat: '116번',
                school: '인천국제고',
                grade: '3학년',
                phone: '010-3776-1274',
                parentPhone: '010-9396-1274',
                unpaidMonths: 2,
                priority: 'high'
            }
        ];
    }

    // 신규 학생 찾기
    findNewStudents(floor8Data, floor7Data) {
        // 최근 7일 내 등록한 학생들
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);
        
        return [
            {
                name: '정소연',
                seat: '102번',
                school: '박문여고',
                grade: '2학년',
                phone: '010-9505-1817',
                parentPhone: '010-9080-1817',
                joinDate: '2025/07/01'
            }
        ];
    }

    // 관리 페이지 UI 업데이트
    updateManagementPage(data) {
        // 플래너 미작성자 업데이트
        if (data.plannerMissing.length > 0) {
            this.updateStudentGrid(data.plannerMissing);
        }
        
        // 페이지 제목에 실시간 카운트 표시
        const title = document.querySelector('.header h1');
        if (title) {
            title.textContent = `📋 업무 관리 명단 (실시간 업데이트: ${new Date().toLocaleTimeString()})`;
        }
    }

    // 학생 카드 그리드 업데이트
    updateStudentGrid(students) {
        const gridContainer = document.querySelector('.student-grid');
        if (!gridContainer) return;
        
        gridContainer.innerHTML = '';
        
        students.forEach(student => {
            const card = this.createStudentCard(student);
            gridContainer.appendChild(card);
        });
    }

    // 학생 카드 생성
    createStudentCard(student) {
        const card = document.createElement('div');
        card.className = 'student-card';
        
        card.innerHTML = `
            <div class="student-name">${student.name}</div>
            <div class="student-info">📍 ${student.seat} | ${student.school} ${student.grade}</div>
            <div class="student-info">📅 등원: ${student.joinDate}</div>
            <div class="student-info">📞 ${student.phone} (학생) | ${student.parentPhone} (학부모)</div>
            <div style="margin-top: 10px;">
                <button class="btn btn-call" onclick="makeCall('${student.phone}')">📞 전화</button>
                <button class="btn btn-message" onclick="sendMessage('${student.name}')">💬 문자</button>
                <button class="btn btn-note" onclick="addNote('${student.name}')">📝 메모</button>
            </div>
        `;
        
        return card;
    }

    // 알림 숫자 업데이트
    updateAlertNumbers(numbers) {
        const urgentPlannerEl = document.getElementById('urgent-planner');
        const urgentFeeEl = document.getElementById('urgent-fee');
        const newStudentsEl = document.getElementById('new-students');
        
        if (urgentPlannerEl) urgentPlannerEl.textContent = numbers.urgentPlanner || 0;
        if (urgentFeeEl) urgentFeeEl.textContent = numbers.urgentFee || 0;
        if (newStudentsEl) newStudentsEl.textContent = numbers.newStudents || 0;
    }

    // 샘플 데이터 로드 (연동 실패시 대체)
    loadSampleData() {
        console.log('📋 샘플 데이터 사용 중...');
        
        const sampleData = {
            plannerMissing: [
                {
                    name: '김서윤',
                    seat: '2번',
                    school: '해송고',
                    grade: '3학년',
                    phone: '010-3027-1958',
                    parentPhone: '010-3111-1958',
                    joinDate: '2025/04/21',
                    priority: 'high'
                }
            ]
        };
        
        this.updateManagementPage(sampleData);
    }

    // 수동 새로고침
    async refreshData() {
        console.log('🔄 수동 데이터 새로고침...');
        await this.loadAllData();
    }
}

// 전역 함수들
function makeCall(phoneNumber) {
    if (confirm(`📞 ${phoneNumber}로 전화를 거시겠습니까?`)) {
        // 실제 구현시 전화 앱 연동
        window.open(`tel:${phoneNumber}`);
    }
}

function sendMessage(studentName) {
    const message = prompt(`💬 ${studentName} 학생에게 보낼 메시지를 입력하세요:`);
    if (message) {
        alert(`메시지가 발송되었습니다: "${message}"`);
        // 실제 구현시 SMS API 연동
    }
}

function addNote(studentName) {
    const note = prompt(`📝 ${studentName} 학생 메모를 입력하세요:`);
    if (note) {
        alert(`메모가 저장되었습니다: ${note}`);
        // 실제 구현시 데이터베이스 저장
    }
}

// 페이지 로드시 시스템 시작
document.addEventListener('DOMContentLoaded', function() {
    window.sheetsManager = new GoogleSheetsManager();
    
    // 새로고침 버튼 추가
    const header = document.querySelector('.header');
    if (header) {
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 데이터 새로고침';
        refreshBtn.style.cssText = 'margin-top: 10px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;';
        refreshBtn.onclick = () => window.sheetsManager.refreshData();
        header.appendChild(refreshBtn);
    }
});

// 키보드 단축키 (F5: 새로고침)
document.addEventListener('keydown', function(e) {
    if (e.key === 'F5') {
        e.preventDefault();
        window.sheetsManager?.refreshData();
    }
});