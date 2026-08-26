import re
import sys

def main():
    file_path = 'index.html'
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # 1. Update CSS
    new_css = """  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

    :root {
      --bg-color: #040f16;
      --bg-gradient: radial-gradient(circle at 15% 50%, rgba(2, 132, 199, 0.15), transparent 25%),
                     radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.1), transparent 25%);
      --card-bg-rgb: 11, 33, 45; 
      --card-bg: rgba(var(--card-bg-rgb), 0.65);
      --primary: #38bdf8;
      --primary-hover: #0284c7;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: rgba(30, 58, 76, 0.7);
      --border-focus: #38bdf8;
      --success: #10b981;
      --danger: #ef4444;
      --glass-blur: blur(16px);
      --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
    }

    [data-theme="light"] {
      --bg-color: #f0f4f8;
      --bg-gradient: radial-gradient(circle at 15% 50%, rgba(56, 189, 248, 0.15), transparent 25%),
                     radial-gradient(circle at 85% 30%, rgba(2, 132, 199, 0.1), transparent 25%);
      --card-bg-rgb: 255, 255, 255;
      --card-bg: rgba(var(--card-bg-rgb), 0.7);
      --primary: #0284c7;
      --primary-hover: #0369a1;
      --text-main: #0f172a;
      --text-muted: #475569;
      --border-color: rgba(226, 232, 240, 0.8);
      --border-focus: #0284c7;
      --success: #059669;
      --danger: #dc2626;
      --glass-blur: blur(20px);
      --glass-shadow: 0 8px 32px 0 rgba(148, 163, 184, 0.15);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    body {
      background-color: var(--bg-color);
      background-image: var(--bg-gradient);
      background-attachment: fixed;
      color: var(--text-main);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 20px;
      transition: background-color 0.4s ease, color 0.4s ease, background-image 0.4s ease;
    }

    .main-wrapper {
      display: flex;
      flex-direction: row;
      gap: 20px;
      width: 100%;
      max-width: 1400px;
      align-items: stretch;
      margin: 0 auto;
      height: calc(100vh - 40px);
    }

    .container, .table-container {
      background-color: var(--card-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
      box-shadow: var(--glass-shadow);
      transition: background-color 0.4s ease, border-color 0.4s ease;
    }

    .container {
      width: 100%;
      max-width: 500px;
      flex-shrink: 0;
      position: relative;
      overflow-y: auto;
    }

    .container::-webkit-scrollbar, .excel-table-wrapper::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .container::-webkit-scrollbar-thumb, .excel-table-wrapper::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }

    .table-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .table-header h3 {
      color: var(--primary);
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .table-actions {
      display: flex;
      gap: 10px;
    }

    .excel-table-wrapper {
      flex: 1;
      overflow: auto;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background: rgba(var(--card-bg-rgb), 0.3);
    }

    table.excel-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    table.excel-table th, table.excel-table td {
      border-bottom: 1px solid var(--border-color);
      padding: 14px 12px;
      text-align: left;
    }

    table.excel-table th {
      background-color: rgba(var(--card-bg-rgb), 0.95);
      backdrop-filter: blur(10px);
      color: var(--primary);
      position: sticky;
      top: 0;
      z-index: 10;
      font-weight: 600;
      letter-spacing: 0.5px;
      box-shadow: 0 1px 0 var(--border-color);
    }

    table.excel-table tbody tr {
      transition: background-color 0.2s ease;
    }

    table.excel-table tbody tr:hover {
      background-color: rgba(56, 189, 248, 0.05);
    }

    .header {
      margin-bottom: 25px;
    }

    .header h2 {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .header p {
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 400;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 22px;
    }

    .input-group label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-main);
      letter-spacing: 0.3px;
    }

    input[type="text"],
    input[type="url"],
    input[type="password"] {
      flex: 1;
      padding: 14px 16px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background-color: rgba(var(--card-bg-rgb), 0.4);
      color: var(--text-main);
      font-size: 0.95rem;
      outline: none;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
    }

    input[type="text"]:focus,
    input[type="url"]:focus,
    input[type="password"]:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
      background-color: rgba(var(--card-bg-rgb), 0.8);
    }

    button {
      padding: 12px 20px;
      background-color: var(--primary);
      color: #0f172a;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
    }

    button:hover {
      background-color: var(--primary-hover);
      color: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.2);
    }

    button:active {
      transform: translateY(1px);
      box-shadow: none;
    }

    .btn-copy {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--primary);
      padding: 8px 14px;
      font-size: 0.8rem;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .btn-copy:hover {
      background-color: rgba(56, 189, 248, 0.1);
      border-color: var(--primary);
      color: var(--primary);
    }

    .btn-delete {
      background-color: transparent;
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .btn-delete:hover {
      background-color: var(--danger);
      color: #ffffff;
      border-color: var(--danger);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }

    .btn-process {
      width: 100%;
      background: linear-gradient(135deg, var(--primary), var(--primary-hover));
      color: #ffffff;
      font-size: 0.95rem;
      padding: 14px;
      box-shadow: 0 4px 15px rgba(56, 189, 248, 0.25);
    }
    .btn-process:hover {
      box-shadow: 0 6px 20px rgba(56, 189, 248, 0.4);
    }

    .btn-send-sheets {
      width: 100%;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      font-size: 0.95rem;
      padding: 14px;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.25);
    }
    .btn-send-sheets:hover {
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
    }

    .loader {
      display: none;
      text-align: center;
      padding: 30px 20px;
      color: var(--primary);
      font-size: 0.9rem;
      font-weight: 500;
      animation: pulse 1.5s infinite ease-in-out;
    }
    
    .loader-spinner {
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top: 3px solid var(--primary);
      border-radius: 50%;
      width: 28px;
      height: 28px;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

    .results-card {
      display: none;
      background: rgba(var(--card-bg-rgb), 0.4);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      margin-top: 15px;
      animation: fadeIn 0.4s ease forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .field-row {
      margin-bottom: 16px;
    }

    .field-row label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 6px;
      font-weight: 600;
    }

    .field-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: rgba(var(--card-bg-rgb), 0.6);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px 14px;
      transition: all 0.3s ease;
    }
    .field-content:hover {
      border-color: rgba(56, 189, 248, 0.4);
      background-color: rgba(var(--card-bg-rgb), 0.8);
    }

    .field-value {
      font-size: 0.95rem;
      color: var(--text-main);
      word-break: break-all;
      margin-right: 12px;
      font-weight: 500;
    }

    .btn-copy-all {
      width: 100%;
      padding: 14px;
      background-color: rgba(56, 189, 248, 0.1);
      color: var(--primary);
      border: 1px dashed var(--primary);
      border-radius: 10px;
      font-weight: 600;
      margin-top: 20px;
      box-shadow: none;
    }
    .btn-copy-all:hover {
      background-color: var(--primary);
      color: #ffffff;
      border-style: solid;
    }

    /* Theme Toggle Button */
    .theme-toggle-btn {
      background: rgba(var(--card-bg-rgb), 0.5);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      font-size: 1.2rem;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    .theme-toggle-btn:hover {
      background: var(--border-color);
      transform: rotate(15deg) scale(1.05);
    }

    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      animation: fadeIn 0.3s ease;
    }

    .modal-content {
      width: 95%;
      max-width: 600px;
      max-height: 90vh;
      border-radius: 16px;
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      background-color: var(--card-bg);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-color);
      box-shadow: var(--glass-shadow);
    }
    @keyframes slideUpModal {
      from { opacity: 0; transform: translateY(30px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .toast {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background-color: var(--success);
      color: #ffffff;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
      z-index: 9999;
      transform: translateY(100px);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
    .toast.error {
      background-color: var(--danger);
      box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4);
    }

    @media (max-width: 1024px) {
      .main-wrapper {
        flex-direction: column;
        height: auto;
      }
      .container {
        max-width: 100%;
        overflow-y: visible;
      }
      .table-container {
        height: 600px;
      }
    }

    @media (max-width: 600px) {
      body { padding: 12px; }
      .container, .table-container { padding: 16px; }
      .input-row { flex-wrap: wrap; }
      .input-row > input { min-width: 100%; margin-bottom: 10px !important; }
      .input-row > button { flex: 1; }
      .action-buttons-container { flex-direction: column; }
    }
  </style>"""

    # Replace everything between <style> and </style>
    new_content = re.sub(r'<style>.*?</style>', new_css, content, flags=re.DOTALL)

    # 2. Add spinner and icons to loader and toast
    new_content = new_content.replace(
        '<div id="loader" class="loader">\n      ⏳ Membaca koordinat dan menghubungi Google API...\n    </div>',
        '<div id="loader" class="loader">\n      <div class="loader-spinner"></div>\n      Membaca koordinat & menghubungi Google API...\n    </div>'
    )
    
    # 3. Toast modifications
    new_content = new_content.replace(
        """    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;

      if (type === 'error') {
        toast.classList.add('error');
      } else {
        toast.classList.remove('error');
      }

      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3500);
    }""",
        """    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.innerHTML = type === 'error' ? '⚠️ ' + message : '✅ ' + message;

      if (type === 'error') {
        toast.classList.add('error');
      } else {
        toast.classList.remove('error');
      }

      toast.style.display = 'flex';
      // Force reflow
      void toast.offsetWidth;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (!toast.classList.contains('show')) {
            toast.style.display = 'none';
          }
        }, 400); // Wait for transition
      }, 3500);
    }"""
    )
    
    # Update modal content class
    new_content = new_content.replace(
        """    <div
      style="background:var(--card-bg); width:95%; max-width:600px; max-height:90vh; border-radius:12px; position:relative; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--border-color); box-shadow:0 10px 25px rgba(0,0,0,0.5); transition: background-color 0.3s ease, border-color 0.3s ease;">""",
        """    <div class="modal-content">"""
    )
    new_content = new_content.replace(
        """      <div
        style="padding:15px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background-color: var(--bg-color); transition: background-color 0.3s ease;">""",
        """      <div style="padding:15px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background-color: rgba(var(--card-bg-rgb), 0.3); transition: background-color 0.3s ease;">"""
    )
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Updated successfully!")
    except Exception as e:
        print(f"Error writing file: {e}")

if __name__ == "__main__":
    main()
