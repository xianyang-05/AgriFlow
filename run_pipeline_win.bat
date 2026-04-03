@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ===================================================
echo   AgriFlow - 价格预测模型训练管道 (Windows 版)
echo ===================================================
echo.

:: 检查 Python 是否安装
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Python。请安装 Python 并添加到 PATH。
    pause
    exit /b 1
)
echo ✅ Python 已找到

:: 检查依赖
echo 📦 检查必要的库...
python -c "import pandas, numpy, xgboost, sklearn, joblib, matplotlib" > nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ 缺少必要的库，正在安装...
    pip install pandas numpy xgboost scikit-learn joblib matplotlib
) else (
    echo ✅ 所有依赖库已安装
)
echo.

:: 检查原始数据是否存在
if not exist "data\raw\malaysia_crop_prices.csv" (
    echo ❌ 错误: 找不到原始数据文件 data\raw\malaysia_crop_prices.csv
    echo 请确保您已经运行了爬虫或将数据文件放在了正确的位置。
    pause
    exit /b 1
)

echo 🚀 开始执行数据管道...
echo.

echo [1/4] 对齐价格与天气数据...
python align_daily_data_win.py
if %errorlevel% neq 0 (
    echo ❌ 步骤 1 失败！
    pause
    exit /b 1
)
echo ✅ 步骤 1 完成
echo.

echo [2/4] 特征工程...
python feature_engineering_daily_win.py
if %errorlevel% neq 0 (
    echo ❌ 步骤 2 失败！
    pause
    exit /b 1
)
echo ✅ 步骤 2 完成
echo.

echo [3/4] 训练模型...
python train_daily_model_win.py
if %errorlevel% neq 0 (
    echo ❌ 步骤 3 失败！
    pause
    exit /b 1
)
echo ✅ 步骤 3 完成
echo.

echo [4/4] 测试生产管道...
python production_pipeline_win.py
if %errorlevel% neq 0 (
    echo ❌ 步骤 4 失败！
    pause
    exit /b 1
)
echo ✅ 步骤 4 完成
echo.

echo ===================================================
echo 🎉 恭喜！所有步骤已成功完成！
echo 模型已保存在 models\saved_models\ 目录下。
echo 您现在可以运行 backend_windows.py 启动 API 服务器了。
echo ===================================================
pause
