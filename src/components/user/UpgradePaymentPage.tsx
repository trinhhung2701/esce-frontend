import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axiosInstance from '~/utils/axiosInstance'
import { API_ENDPOINTS } from '~/config/api'
import { requestAgencyUpgrade } from '~/api/user/instances/RoleUpgradeApi'
import Header from './Header'
import Footer from './Footer'
import Button from './ui/Button'
import { Card, CardContent } from './ui/Card'
import LoadingSpinner from './LoadingSpinner'
import {
  ArrowLeftIcon,
  AlertCircleIcon,
  CheckCircleIcon
} from './icons/index'
import './UpgradePaymentPage.css'

interface AgencyFormData {
  companyName: string
  licenseFile: string
  phone: string
  email: string
  website?: string
}

interface HostFormData {
  businessName: string
  businessLicenseFile: string
  phone: string
  email: string
  address: string
  description?: string
}

interface UpgradePaymentData {
  type: 'host' | 'agency'
  amount: number
  businessName?: string
  companyName?: string
  certificateId?: number
  formData?: AgencyFormData | HostFormData
}

interface PaymentResponse {
  checkoutUrl?: string
  CheckoutUrl?: string
  qrCode?: string
  QrCode?: string
  paymentLinkId?: string
  PaymentLinkId?: string
  orderCode?: number
  OrderCode?: number
  amount?: number
  Amount?: number
  description?: string
  Description?: string
  accountNumber?: string
  AccountNumber?: string
  accountName?: string
  AccountName?: string
  bin?: string
  Bin?: string
}

const UpgradePaymentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [paymentData, setPaymentData] = useState<UpgradePaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentResponse | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
  const upgradeSubmittedRef = useRef(false) // Prevent double submission

  useEffect(() => {
    // Lấy dữ liệu từ location.state (được truyền từ RegisterHost/RegisterAgency)
    const data = location.state as UpgradePaymentData
    if (data) {
      setPaymentData(data)
      setLoading(false)
      // Tự động tạo payment khi vào trang
      createPayment(data)
    } else {
      // Nếu không có data, quay lại trang upgrade
      navigate('/upgrade-account')
    }
  }, [location, navigate])

  // Get userId helper
  const getUserId = useCallback(() => {
    try {
      const userInfoStr = localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        const userId = userInfo.Id || userInfo.id
        if (userId) {
          const parsedId = parseInt(userId)
          if (!isNaN(parsedId) && parsedId > 0) {
            return parsedId
          }
        }
      }
      return null
    } catch (error) {
      console.error('Error getting user ID:', error)
      return null
    }
  }, [])

  // Tạo payment và lấy QR code
  const createPayment = async (data: UpgradePaymentData) => {
    setProcessing(true)
    setError(null)

    try {
      const userId = getUserId()
      if (!userId) {
        setError('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.')
        setProcessing(false)
        return
      }

      // Host upgrade miễn phí
      if (data.type === 'host') {
        navigate('/upgrade-payment-success', {
          state: {
            type: data.type,
            amount: 0,
            paymentMethod: 'free',
            certificateId: data.certificateId
          }
        })
        return
      }

      // Lưu thông tin form vào localStorage để sử dụng sau khi PayOS redirect về
      if (data.formData) {
        localStorage.setItem(
          'pendingUpgradeRequest',
          JSON.stringify({
            type: data.type,
            amount: data.amount,
            companyName: data.companyName,
            formData: data.formData
          })
        )
        console.log('Saved pending upgrade request to localStorage')
      }

      // Gọi API tạo upgrade payment cho Agency
      const description = `Nâng cấp Agency`.substring(0, 25)

      const response = await axiosInstance.post<PaymentResponse>(
        `${API_ENDPOINTS.PAYMENT}/create-upgrade-payment`,
        {
          UserId: userId,
          UpgradeType: 'Agency',
          Amount: data.amount,
          Description: description
        }
      )

      const responseData = response.data
      console.log('Payment response:', responseData)

      // Lấy QR code URL
      const qrCode = responseData?.qrCode || responseData?.QrCode
      const checkoutUrl = responseData?.checkoutUrl || responseData?.CheckoutUrl

      if (qrCode) {
        setQrCodeUrl(qrCode)
        setPaymentInfo(responseData)
      } else if (checkoutUrl) {
        // Nếu không có QR code, redirect đến checkout URL
        window.location.href = checkoutUrl
        return
      } else {
        setError('Không thể tạo mã QR thanh toán. Vui lòng thử lại.')
      }
    } catch (err: any) {
      console.error('Error creating upgrade payment:', err)
      const errorMessage =
        err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo thanh toán. Vui lòng thử lại.'
      setError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  // Gọi API tạo yêu cầu upgrade sau khi thanh toán thành công
  const submitUpgradeRequest = useCallback(async () => {
    if (!paymentData?.formData || upgradeSubmittedRef.current) return

    upgradeSubmittedRef.current = true
    setSubmittingUpgrade(true)

    try {
      if (paymentData.type === 'agency') {
        const formData = paymentData.formData as AgencyFormData
        await requestAgencyUpgrade({
          companyName: formData.companyName,
          licenseFile: formData.licenseFile,
          phone: formData.phone,
          email: formData.email,
          website: formData.website
        })
        console.log('Agency upgrade request submitted successfully')
      }
      // TODO: Add host upgrade logic if needed

      // Chuyển đến trang thành công
      navigate('/upgrade-payment-success', {
        state: {
          type: paymentData?.type,
          amount: paymentData?.amount,
          paymentMethod: 'payos',
          companyName: paymentData?.companyName
        }
      })
    } catch (err: any) {
      console.error('Error submitting upgrade request:', err)
      // Vẫn chuyển đến trang thành công vì đã thanh toán
      // Admin sẽ xử lý thủ công nếu có lỗi
      navigate('/upgrade-payment-success', {
        state: {
          type: paymentData?.type,
          amount: paymentData?.amount,
          paymentMethod: 'payos',
          companyName: paymentData?.companyName,
          warning: 'Thanh toán thành công nhưng có lỗi khi gửi yêu cầu. Vui lòng liên hệ Admin.'
        }
      })
    } finally {
      setSubmittingUpgrade(false)
    }
  }, [paymentData, navigate])

  // Kiểm tra trạng thái thanh toán
  const checkPaymentStatus = useCallback(async () => {
    if (!paymentInfo) return

    const orderCode = paymentInfo.orderCode || paymentInfo.OrderCode
    if (!orderCode) return

    setCheckingPayment(true)

    try {
      const response = await axiosInstance.get(`${API_ENDPOINTS.PAYMENT}/upgrade-status/${orderCode}`)
      const status = response.data?.status || response.data?.Status

      if (status === 'PAID' || status === 'paid' || status === 'completed' || status === 'success') {
        setPaymentSuccess(true)
        // Thanh toán thành công -> Gọi API tạo yêu cầu upgrade
        await submitUpgradeRequest()
      }
    } catch (err) {
      console.error('Error checking payment status:', err)
    } finally {
      setCheckingPayment(false)
    }
  }, [paymentInfo, submitUpgradeRequest])

  // Polling kiểm tra trạng thái thanh toán mỗi 5 giây
  useEffect(() => {
    if (!qrCodeUrl || paymentSuccess) return

    const interval = setInterval(() => {
      checkPaymentStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [qrCodeUrl, paymentSuccess, checkPaymentStatus])

  if (loading) {
    return (
      <div className="upg-pay-upgrade-payment-page">
        <Header />
        <main className="upg-pay-upgrade-payment-main">
          <div className="upg-pay-upgrade-payment-container">
            <LoadingSpinner message="Đang tải thông tin thanh toán..." />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!paymentData) {
    return null
  }

  const typeLabel = paymentData.type === 'host' ? 'Host' : 'Agency'
  const name = paymentData.businessName || paymentData.companyName || ''

  return (
    <div className="upg-pay-upgrade-payment-page">
      <Header />
      <main className="upg-pay-upgrade-payment-main">
        <div className="upg-pay-upgrade-payment-container">
          {/* Header */}
          <div className="upg-pay-payment-header">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/upgrade-account')}
              className="upg-pay-back-button"
            >
              <ArrowLeftIcon className="upg-pay-back-icon" />
              Quay lại
            </Button>
            <h1 className="upg-pay-payment-title">Thanh toán nâng cấp tài khoản</h1>
            <p className="upg-pay-payment-subtitle">Quét mã QR để thanh toán phí nâng cấp lên {typeLabel}</p>
          </div>

          <div className="upg-pay-payment-content-grid">
            {/* QR Code Section */}
            <Card className="upg-pay-payment-qr-card">
              <CardContent>
                <h2 className="upg-pay-info-card-title">Quét mã QR để thanh toán</h2>

                {processing && (
                  <div className="upg-pay-qr-loading">
                    <LoadingSpinner message="Đang tạo mã QR thanh toán..." />
                  </div>
                )}

                {error && !processing && (
                  <div className="upg-pay-error-alert">
                    <AlertCircleIcon className="upg-pay-error-icon" />
                    <span>{error}</span>
                  </div>
                )}

                {paymentSuccess && (
                  <div className="upg-pay-success-alert">
                    <CheckCircleIcon className="upg-pay-success-icon" />
                    <span>
                      {submittingUpgrade
                        ? 'Thanh toán thành công! Đang gửi yêu cầu nâng cấp...'
                        : 'Thanh toán thành công! Đang chuyển hướng...'}
                    </span>
                  </div>
                )}

                {qrCodeUrl && !paymentSuccess && (
                  <div className="upg-pay-qr-container">
                    <img src={qrCodeUrl} alt="QR Code thanh toán" className="upg-pay-qr-image" />
                    <p className="upg-pay-qr-instruction">
                      Mở ứng dụng ngân hàng hoặc ví điện tử và quét mã QR để thanh toán
                    </p>
                    {checkingPayment && (
                      <p className="upg-pay-checking-status">
                        <span className="upg-pay-spinner-small"></span>
                        Đang kiểm tra trạng thái thanh toán...
                      </p>
                    )}
                  </div>
                )}

                {!qrCodeUrl && !processing && !error && (
                  <Button
                    onClick={() => paymentData && createPayment(paymentData)}
                    variant="default"
                    size="lg"
                    className="upg-pay-retry-button"
                  >
                    Tạo mã QR thanh toán
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card className="upg-pay-payment-info-card">
              <CardContent>
                <h2 className="upg-pay-info-card-title">Thông tin thanh toán</h2>
                <div className="upg-pay-payment-details">
                  <div className="upg-pay-detail-row">
                    <span className="upg-pay-detail-label">Loại nâng cấp:</span>
                    <span className="upg-pay-detail-value">Nâng cấp lên {typeLabel}</span>
                  </div>
                  {name && (
                    <div className="upg-pay-detail-row">
                      <span className="upg-pay-detail-label">
                        {paymentData.type === 'host' ? 'Tên doanh nghiệp:' : 'Tên công ty:'}
                      </span>
                      <span className="upg-pay-detail-value">{name}</span>
                    </div>
                  )}
                  {paymentInfo?.accountNumber && (
                    <div className="upg-pay-detail-row">
                      <span className="upg-pay-detail-label">Số tài khoản:</span>
                      <span className="upg-pay-detail-value">{paymentInfo.accountNumber}</span>
                    </div>
                  )}
                  {paymentInfo?.accountName && (
                    <div className="upg-pay-detail-row">
                      <span className="upg-pay-detail-label">Tên tài khoản:</span>
                      <span className="upg-pay-detail-value">{paymentInfo.accountName}</span>
                    </div>
                  )}
                  <div className="upg-pay-detail-row upg-pay-total-row">
                    <span className="upg-pay-detail-label">Tổng tiền:</span>
                    <span className="upg-pay-detail-value upg-pay-total-amount">
                      {new Intl.NumberFormat('vi-VN').format(paymentData.amount)}{' '}
                      <span className="upg-pay-currency">VNĐ</span>
                    </span>
                  </div>
                </div>

                <div className="upg-pay-payment-note">
                  <p>• Sau khi thanh toán thành công, yêu cầu của bạn sẽ được gửi tới Admin để xét duyệt.</p>
                  <p>• Thời gian xét duyệt: 1-3 ngày làm việc.</p>
                  <p>• Nếu yêu cầu bị từ chối, bạn sẽ được hoàn lại 100% phí đã thanh toán.</p>
                </div>

                <Button
                  onClick={checkPaymentStatus}
                  disabled={checkingPayment || !qrCodeUrl}
                  variant="outline"
                  size="lg"
                  className="upg-pay-check-button"
                >
                  {checkingPayment ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="upg-pay-spinner-small"></span>
                      Đang kiểm tra...
                    </span>
                  ) : (
                    'Tôi đã thanh toán'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default UpgradePaymentPage
