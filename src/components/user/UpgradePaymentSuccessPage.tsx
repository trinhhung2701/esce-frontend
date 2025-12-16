import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import axiosInstance from '~/utils/axiosInstance'
import { API_ENDPOINTS } from '~/config/api'
import { requestAgencyUpgrade } from '~/api/user/instances/RoleUpgradeApi'
import Header from './Header'
import Footer from './Footer'
import Button from './ui/Button'
import { Card, CardContent } from './ui/Card'
import LoadingSpinner from './LoadingSpinner'
import {
  CheckCircleIcon,
  ArrowRightIcon,
  ClockIcon,
  ShieldCheckIcon,
  AlertCircleIcon
} from './icons/index'
import './UpgradePaymentSuccessPage.css'

interface PaymentSuccessData {
  type: 'host' | 'agency'
  amount: number
  paymentMethod: string
  certificateId?: number
  companyName?: string
  warning?: string
}

interface PendingUpgradeRequest {
  type: 'host' | 'agency'
  amount: number
  companyName?: string
  formData?: {
    companyName: string
    licenseFile: string
    phone: string
    email: string
    website?: string
  }
}

const COUNTDOWN_SECONDS = 10 // Số giây đếm ngược trước khi redirect

const UpgradePaymentSuccessPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | 'pending' | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
  const upgradeSubmittedRef = useRef(false)

  // Gọi API tạo yêu cầu upgrade từ localStorage
  const submitPendingUpgradeRequest = async (): Promise<boolean> => {
    const pendingRequestStr = localStorage.getItem('pendingUpgradeRequest')
    if (!pendingRequestStr || upgradeSubmittedRef.current) {
      return false
    }

    upgradeSubmittedRef.current = true
    setSubmittingUpgrade(true)

    try {
      const pendingRequest: PendingUpgradeRequest = JSON.parse(pendingRequestStr)
      console.log('Found pending upgrade request:', pendingRequest)

      if (pendingRequest.type === 'agency' && pendingRequest.formData) {
        await requestAgencyUpgrade({
          companyName: pendingRequest.formData.companyName,
          licenseFile: pendingRequest.formData.licenseFile,
          phone: pendingRequest.formData.phone,
          email: pendingRequest.formData.email,
          website: pendingRequest.formData.website
        })
        console.log('Agency upgrade request submitted successfully')
      }

      // Xóa pending request sau khi gửi thành công
      localStorage.removeItem('pendingUpgradeRequest')
      return true
    } catch (err: any) {
      console.error('Error submitting pending upgrade request:', err)
      // Vẫn xóa để tránh gửi lại
      localStorage.removeItem('pendingUpgradeRequest')
      return false
    } finally {
      setSubmittingUpgrade(false)
    }
  }

  useEffect(() => {
    const initPage = async () => {
      // Kiểm tra query params từ PayOS callback
      const orderCode = searchParams.get('orderCode')
      const status = searchParams.get('status')
      const cancel = searchParams.get('cancel')

      // Nếu có orderCode từ PayOS callback
      if (orderCode) {
        // Kiểm tra nếu bị cancel
        if (cancel === 'true' || status === 'CANCELLED') {
          setPaymentStatus('cancelled')
          // Xóa pending request nếu bị cancel
          localStorage.removeItem('pendingUpgradeRequest')
          setLoading(false)
          return
        }

        // Kiểm tra trạng thái thanh toán từ backend
        let isPaid = false
        try {
          const response = await axiosInstance.get(`${API_ENDPOINTS.PAYMENT}/upgrade-status/${orderCode}`)
          const paymentStatusFromApi = response.data?.status || response.data?.Status

          if (
            paymentStatusFromApi === 'PAID' ||
            paymentStatusFromApi === 'paid' ||
            paymentStatusFromApi === 'completed' ||
            paymentStatusFromApi === 'success'
          ) {
            isPaid = true
          } else if (paymentStatusFromApi === 'CANCELLED' || paymentStatusFromApi === 'cancelled') {
            setPaymentStatus('cancelled')
            localStorage.removeItem('pendingUpgradeRequest')
            setLoading(false)
            return
          }
        } catch (err) {
          console.error('Error checking payment status:', err)
          // Nếu không kiểm tra được, giả sử thành công nếu có status=PAID trong URL
          if (status === 'PAID') {
            isPaid = true
          }
        }

        if (isPaid) {
          // Thanh toán thành công -> Gọi API tạo yêu cầu upgrade
          const submitted = await submitPendingUpgradeRequest()

          setPaymentStatus('success')
          setSuccessData({
            type: 'agency',
            amount: 0,
            paymentMethod: 'payos',
            warning: submitted ? undefined : 'Thanh toán thành công. Nếu yêu cầu chưa được gửi, vui lòng liên hệ Admin.'
          })
        } else {
          setPaymentStatus('pending')
        }

        setLoading(false)
        return
      }

      // Lấy dữ liệu từ location.state (navigate từ UpgradePaymentPage)
      const data = location.state as PaymentSuccessData
      if (data) {
        setSuccessData(data)
        setPaymentStatus('success')
        // Xóa pending request vì đã được xử lý từ UpgradePaymentPage
        localStorage.removeItem('pendingUpgradeRequest')
        setLoading(false)
      } else {
        // Nếu không có data và không có orderCode, quay lại trang upgrade
        navigate('/upgrade-account')
      }
    }

    initPage()
  }, [location, navigate, searchParams])

  // Countdown timer - chỉ chạy khi thanh toán thành công
  useEffect(() => {
    if (paymentStatus !== 'success' || loading) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [paymentStatus, loading, navigate])

  if (loading) {
    return (
      <div className="upg-success-upgrade-payment-success-page">
        <Header />
        <main className="upg-success-upgrade-payment-success-main">
          <div className="upg-success-upgrade-payment-success-container">
            <LoadingSpinner message="Đang kiểm tra trạng thái thanh toán..." />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Hiển thị khi thanh toán bị hủy
  if (paymentStatus === 'cancelled') {
    return (
      <div className="upg-success-upgrade-payment-success-page">
        <Header />
        <main className="upg-success-upgrade-payment-success-main">
          <div className="upg-success-upgrade-payment-success-container">
            <div className="upg-success-cancelled-icon-wrapper">
              <AlertCircleIcon className="upg-success-cancelled-icon" />
            </div>
            <Card className="upg-success-success-card">
              <CardContent>
                <h1 className="upg-success-cancelled-title">Thanh toán đã bị hủy</h1>
                <p className="upg-success-cancelled-message">
                  Bạn đã hủy thanh toán. Yêu cầu nâng cấp chưa được gửi đi.
                </p>
                <div className="upg-success-action-buttons">
                  <Button
                    onClick={() => navigate('/register/agency')}
                    variant="default"
                    size="lg"
                    className="upg-success-view-status-button"
                  >
                    Thử lại
                    <ArrowRightIcon className="upg-success-button-icon" />
                  </Button>
                  <Button onClick={() => navigate('/')} variant="outline" size="lg" className="upg-success-home-button">
                    Về trang chủ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Hiển thị khi đang chờ xác nhận
  if (paymentStatus === 'pending') {
    return (
      <div className="upg-success-upgrade-payment-success-page">
        <Header />
        <main className="upg-success-upgrade-payment-success-main">
          <div className="upg-success-upgrade-payment-success-container">
            <div className="upg-success-pending-icon-wrapper">
              <ClockIcon className="upg-success-pending-icon" />
            </div>
            <Card className="upg-success-success-card">
              <CardContent>
                <h1 className="upg-success-pending-title">Đơn của bạn đã được gửi thành công</h1>
                <p className="upg-success-pending-message">
                  Vui lòng đợi phản hồi của chúng tôi.
                </p>
                <div className="upg-success-action-buttons">
                  <Button onClick={() => navigate('/')} variant="default" size="lg" className="upg-success-home-button">
                    Về trang chủ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!successData) {
    return null
  }

  const typeLabel = successData.type === 'host' ? 'Host' : 'Agency'
  const isFreeUpgrade = successData.paymentMethod === 'free'
  const methodLabel =
    isFreeUpgrade
      ? 'Miễn phí'
      : successData.paymentMethod === 'vnpay'
        ? 'VNPay'
        : successData.paymentMethod === 'momo'
          ? 'MoMo'
          : successData.paymentMethod === 'payos'
            ? 'PayOS'
            : 'Chuyển khoản ngân hàng'

  return (
    <div className="upg-success-upgrade-payment-success-page">
      <Header />
      <main className="upg-success-upgrade-payment-success-main">
        <div className="upg-success-upgrade-payment-success-container">
          {/* Success Icon */}
          <div className="upg-success-success-icon-wrapper">
            <CheckCircleIcon className="upg-success-success-icon" />
          </div>

          {/* Warning if any */}
          {successData.warning && (
            <div className="upg-success-warning-alert">
              <AlertCircleIcon className="upg-success-warning-icon" />
              <span>{successData.warning}</span>
            </div>
          )}

          {/* Success Message */}
          <Card className="upg-success-success-card">
            <CardContent>
              <h1 className="upg-success-success-title">
                {isFreeUpgrade ? 'Yêu cầu nâng cấp đã được gửi thành công!' : 'Thanh toán thành công!'}
              </h1>
              <p className="upg-success-success-message">
                Yêu cầu nâng cấp lên {typeLabel} của bạn đã được gửi thành công và đang chờ Admin phê duyệt.
              </p>

              {/* Countdown */}
              <div className="upg-success-countdown">
                <p className="upg-success-countdown-text">
                  Tự động về trang chủ sau <span className="upg-success-countdown-number">{countdown}</span> giây
                </p>
              </div>
                  {isFreeUpgrade && successData.type === 'host' && (
                    <div className="upg-success-host-fee-notice">
                      <p className="upg-success-host-fee-notice-text">
                        <strong>Lưu ý:</strong> Nâng cấp tài khoản Host là miễn phí. Tuy nhiên, khi bạn bán dịch vụ, sẽ có một khoản phí 10% của giá trị đơn dịch vụ được trả cho admin của hệ thống.
                      </p>
                    </div>
                  )}

              {/* Payment Details */}
              <div className="upg-success-payment-details-section">
                <h2 className="upg-success-details-title">Chi tiết thanh toán</h2>
                <div className="upg-success-details-list">
                  <div className="upg-success-detail-item">
                    <span className="upg-success-detail-label">Loại nâng cấp:</span>
                    <span className="upg-success-detail-value">Nâng cấp lên {typeLabel}</span>
                  </div>
                  {!isFreeUpgrade && (
                    <div className="upg-success-detail-item">
                      <span className="upg-success-detail-label">Số tiền:</span>
                      <span className="upg-success-detail-value upg-success-amount">
                        {new Intl.NumberFormat('vi-VN').format(successData.amount)} <span className="upg-success-currency">VNĐ</span>
                      </span>
                    </div>
                  )}
                  {isFreeUpgrade && (
                    <div className="upg-success-detail-item">
                      <span className="upg-success-detail-label">Phí nâng cấp:</span>
                      <span className="upg-success-detail-value upg-success-amount">Miễn phí</span>
                    </div>
                  )}
                  <div className="upg-success-detail-item">
                    <span className="upg-success-detail-label">Phương thức thanh toán:</span>
                    <span className="upg-success-detail-value">{methodLabel}</span>
                  </div>
                  {successData.certificateId && (
                    <div className="upg-success-detail-item">
                      <span className="upg-success-detail-label">Mã yêu cầu:</span>
                      <span className="upg-success-detail-value">#{successData.certificateId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              <div className="upg-success-next-steps-section">
                <div className="upg-success-step-item">
                  <div className="upg-success-step-icon">
                    <ClockIcon />
                  </div>
                  <div className="upg-success-step-content">
                    <h3 className="upg-success-step-title">Đang chờ xét duyệt</h3>
                    <p className="upg-success-step-description">
                      Yêu cầu của bạn đã được gửi tới Admin. Thời gian xét duyệt: <strong>1-3 ngày làm việc</strong>.
                    </p>
                  </div>
                </div>

                {!isFreeUpgrade && (
                  <div className="upg-success-step-item">
                    <div className="upg-success-step-icon">
                      <ShieldCheckIcon />
                    </div>
                    <div className="upg-success-step-content">
                      <h3 className="upg-success-step-title">Bảo vệ quyền lợi</h3>
                      <p className="upg-success-step-description">
                        Nếu yêu cầu bị từ chối, bạn sẽ được <strong>hoàn lại 100%</strong> phí đã thanh toán.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="upg-success-action-buttons">
                <Button
                  onClick={() => navigate('/profile', { state: { activeTab: 'certificates' } })}
                  variant="default"
                  size="lg"
                  className="upg-success-view-status-button"
                >
                  Xem trạng thái yêu cầu
                  <ArrowRightIcon className="upg-success-button-icon" />
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  size="lg"
                  className="upg-success-home-button"
                >
                  Về trang chủ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default UpgradePaymentSuccessPage









