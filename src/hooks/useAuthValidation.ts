import { useEffect, useCallback } from 'react'
import { API_BASE_URL } from '~/config/api'

/**
 * Hook để validate token khi app khởi động
 * Nếu token không hợp lệ hoặc hết hạn, sẽ tự động clear localStorage
 */
export const useAuthValidation = () => {
  const clearAuthData = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('userInfo')
    // Dispatch event để các component khác biết
    window.dispatchEvent(new CustomEvent('userStorageChange'))
  }, [])

  const validateToken = useCallback(async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    
    // Không có token thì không cần validate
    if (!token) {
      return
    }

    // Lấy userId từ userInfo
    let userId: number | null = null
    try {
      const userInfoStr = localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo')
      if (userInfoStr) {
        const parsed = JSON.parse(userInfoStr)
        userId = parsed?.id ?? parsed?.Id ?? parsed?.userId ?? parsed?.UserId
      }
    } catch {
      // Nếu không parse được userInfo, clear luôn
      console.warn('[AuthValidation] Invalid userInfo in storage, clearing...')
      clearAuthData()
      return
    }

    if (!userId) {
      console.warn('[AuthValidation] No userId found, clearing auth data...')
      clearAuthData()
      return
    }

    try {
      // Gọi API để validate token bằng cách fetch user profile
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout (giảm từ 10s)

      const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Nếu 401 hoặc 403, token không hợp lệ
      if (response.status === 401 || response.status === 403) {
        console.warn('[AuthValidation] Token invalid or expired, clearing auth data...')
        clearAuthData()
        return
      }

      // Nếu 404, user không tồn tại
      if (response.status === 404) {
        console.warn('[AuthValidation] User not found, clearing auth data...')
        clearAuthData()
        return
      }

      // Token hợp lệ, có thể cập nhật userInfo nếu cần
      if (response.ok) {
        try {
          const userData = await response.json()
          // Cập nhật userInfo với dữ liệu mới nhất từ server
          if (userData) {
            const currentUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
            const updatedUserInfo = {
              ...currentUserInfo,
              id: userData.id ?? userData.Id ?? currentUserInfo.id,
              name: userData.name ?? userData.Name ?? currentUserInfo.name,
              email: userData.email ?? userData.Email ?? currentUserInfo.email,
              avatar: userData.avatar ?? userData.Avatar ?? currentUserInfo.avatar,
              roleId: userData.roleId ?? userData.RoleId ?? currentUserInfo.roleId,
              roleName: userData.roleName ?? userData.RoleName ?? userData.Role?.Name ?? currentUserInfo.roleName
            }
            localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo))
            window.dispatchEvent(new CustomEvent('userStorageChange'))
          }
        } catch {
          // Không parse được response, nhưng token vẫn hợp lệ
        }
      }
    } catch (error: any) {
      // Network error - không clear auth data vì có thể chỉ là mất mạng tạm thời
      if (error.name === 'AbortError') {
        console.warn('[AuthValidation] Request timeout, skipping validation')
      } else {
        console.warn('[AuthValidation] Network error during validation:', error.message)
      }
      // Không clear auth data khi network error để tránh logout user khi mất mạng
    }
  }, [clearAuthData])

  useEffect(() => {
    // Validate token sau 1 giây để không block initial render
    const timer = setTimeout(() => {
      validateToken()
    }, 1000)

    // Cũng validate khi tab được focus lại (user quay lại từ tab khác)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateToken()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [validateToken])
}

export default useAuthValidation
