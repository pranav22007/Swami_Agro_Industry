import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Title, Text, Surface, IconButton, Searchbar, Divider, Card, Badge, Modal, Portal, Button, SegmentedButtons } from 'react-native-paper';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const FilterChip = ({ label, active, onPress, theme }: any) => (
  <TouchableOpacity 
    onPress={onPress} 
    style={[
      styles.chip, 
      { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant }
    ]}
  >
    <Text style={[styles.chipText, { color: active ? 'white' : theme.colors.onSurfaceVariant }]}>{label}</Text>
  </TouchableOpacity>
);

const SectionTitle = ({ title }: { title: string }) => (
  <Text style={styles.sectionSubTitle}>{title}</Text>
);

const DetailRow = ({ label, value }: { label: string, value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

export default function PreviousSellScreen() {
  const { activeBusiness } = useBusiness();
  const { theme, isDarkMode } = useAppTheme();
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, today, week, month
  const [payFilter, setPayFilter] = useState('all'); // all, paid, pending

  useEffect(() => {
    if (!activeBusiness?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      
      list.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });

      setTransactions(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions: ", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeBusiness?.id]);

  const getFilteredData = () => {
    let filtered = transactions.filter(t => 
      t.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerPhone?.includes(searchQuery) ||
      t.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Date filtering
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = today - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = today - (30 * 24 * 60 * 60 * 1000);

    if (filterType === 'today') {
      filtered = filtered.filter(t => t.timestamp?.toDate().getTime() >= today);
    } else if (filterType === 'week') {
      filtered = filtered.filter(t => t.timestamp?.toDate().getTime() >= oneWeekAgo);
    } else if (filterType === 'month') {
      filtered = filtered.filter(t => t.timestamp?.toDate().getTime() >= oneMonthAgo);
    }

    // Payment status filtering
    if (payFilter !== 'all') {
      filtered = filtered.filter(t => (t.paymentStatus || 'paid') === payFilter);
    }

    return filtered;
  };

  const filteredTransactions = getFilteredData();
  const totalSalesAmount = filteredTransactions.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const [updating, setUpdating] = useState(false);

  const handleTogglePayment = async (saleId: string, currentStatus: string) => {
    setUpdating(true);
    try {
      const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
      await updateDoc(doc(db, 'transactions', saleId), {
        paymentStatus: newStatus
      });
      if (selectedSale && selectedSale.id === saleId) {
        setSelectedSale({ ...selectedSale, paymentStatus: newStatus });
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t('error'), "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const getBase64Image = async (url: string) => {
    if (!url) return '';
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not fetch image to base64", e);
      return url;
    }
  };

  const generatePDF = async (sale: any) => {
    const businessInfo = activeBusiness;
    const date = sale.timestamp?.toDate().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const itemsHtml = sale.items.map((item: any, index: number) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 15px 10px; text-align: left; font-size: 12px; color: #444;">${index + 1}</td>
        <td style="padding: 15px 10px; text-align: left; font-size: 13px; font-weight: 500;">${item.name}</td>
        <td style="padding: 15px 10px; text-align: center; font-size: 13px;">${item.qty}</td>
        <td style="padding: 15px 10px; text-align: right; font-size: 13px;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding: 15px 10px; text-align: right; font-size: 13px;">${item.gst}%</td>
        <td style="padding: 15px 10px; text-align: right; font-size: 13px; font-weight: bold; color: #1b5e20;">₹${(item.price * item.qty * (1 + item.gst/100)).toFixed(2)}</td>
      </tr>
    `).join('');

    const subtotal = sale.subtotal || sale.items.reduce((acc: number, item: any) => acc + (item.price * item.qty), 0);
    const totalGST = sale.totalGST || (sale.total - subtotal);
    const cdPercentage = sale.cdPercentage ?? 2;
    const cdAmount = sale.cdAmount ?? 0;

    // Use absolute URLs and ensure images are loaded
    const logoUrl = await getBase64Image(businessInfo?.photoUrl || '');
    const signatureUrl = await getBase64Image(businessInfo?.signatureUrl || '');

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page { margin: 0; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #333; background-color: #fff; }
            .container { padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 4px solid #1b5e20; padding-bottom: 20px; }
            .business-info { flex: 2; }
            .logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 15px; border-radius: 12px; background: #f9f9f9; padding: 5px; display: ${logoUrl ? 'block' : 'none'}; }
            .business-name { font-size: 28px; font-weight: 800; color: #1b5e20; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .business-detail { font-size: 12px; color: #666; margin: 3px 0; line-height: 1.4; }
            .invoice-label { flex: 1; text-align: right; }
            .invoice-title { font-size: 42px; font-weight: 900; color: #e8f5e9; margin: 0; position: absolute; right: 40px; top: 30px; z-index: -1; }
            .invoice-meta { margin-top: 50px; }
            .meta-item { font-size: 14px; margin-bottom: 5px; }
            .meta-label { font-weight: bold; color: #1b5e20; }

            .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .bill-box { background: #fcfcfc; padding: 20px; border-radius: 12px; border: 1px solid #f0f0f0; }
            .box-title { font-size: 11px; font-weight: bold; color: #1b5e20; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #e8f5e9; padding-bottom: 8px; margin-bottom: 12px; }
            .customer-name { font-size: 18px; font-weight: 700; margin-bottom: 5px; color: #222; }
            .transport-detail { font-size: 12px; color: #555; margin: 4px 0; display: flex; justify-content: space-between; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #1b5e20; color: white; padding: 12px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; text-align: center; }
            th:first-child { border-radius: 8px 0 0 0; text-align: left; }
            th:last-child { border-radius: 0 8px 0 0; text-align: right; }
            
            .totals-container { display: flex; justify-content: flex-end; }
            .totals-table { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
            .total-row.grand-total { border-top: 2px solid #1b5e20; border-bottom: none; margin-top: 10px; padding-top: 15px; }
            .grand-total-label { font-size: 20px; font-weight: 800; color: #1b5e20; }
            .grand-total-value { font-size: 22px; font-weight: 800; color: #1b5e20; }

            .footer { margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; }
            .bank-info { font-size: 12px; color: #555; background: #f9f9f9; padding: 15px; border-radius: 10px; width: 300px; }
            .signature-box { text-align: center; width: 220px; }
            .signature-img { width: 120px; height: 50px; object-fit: contain; margin-bottom: 5px; display: ${signatureUrl ? 'inline-block' : 'none'}; }
            .signature-line { border-top: 1px solid #333; padding-top: 8px; font-weight: bold; font-size: 12px; color: #1b5e20; }
            
            .thanks { text-align: center; color: #aaa; font-size: 11px; margin-top: 50px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="invoice-title">INVOICE</h1>
            <div class="header">
              <div class="business-info">
                ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                <h2 class="business-name">${businessInfo?.businessName}</h2>
                <p class="business-detail"><b>GSTIN:</b> ${businessInfo?.gstId || 'N/A'}</p>
                <p class="business-detail"><b>Contact:</b> ${businessInfo?.phoneNumber || businessInfo?.phone || ''}</p>
                <p class="business-detail" style="margin-top: 8px; color: #444; font-weight: 500;">${businessInfo?.address || ''}</p>
              </div>
              <div class="invoice-meta">
                <div class="meta-item"><span class="meta-label">Invoice No:</span> ${invNo}</div>
                <div class="meta-item"><span class="meta-label">Date:</span> ${date}</div>
              </div>
            </div>

            <div class="bill-grid">
              <div class="bill-box">
                <div class="box-title">Bill To</div>
                <div class="customer-name">${sale.customerName || 'Walk-in Customer'}</div>
                <p class="business-detail"><b>Phone:</b> ${sale.customerPhone || 'N/A'}</p>
              </div>
              <div class="bill-box">
                <div class="box-title">Transport Details</div>
                <div class="transport-detail"><span>Destination:</span> <b>${sale.destination || 'N/A'}</b></div>
                <div class="transport-detail"><span>Vehicle No:</span> <b>${sale.vehicleNumber || 'N/A'}</b></div>
                <div class="transport-detail"><span>Dispatch:</span> <b>${sale.dispatchLocation || 'N/A'}</b></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  <th style="text-align: left;">Item Description</th>
                  <th>Qty</th>
                  <th style="text-align: right;">Rate</th>
                  <th style="text-align: right;">GST</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="footer">
              <div class="bank-info">
                <div class="box-title" style="border-bottom: 1px solid #ddd; margin-bottom: 8px;">Bank Details</div>
                ${bank ? `
                  <div style="margin-bottom: 3px;"><b>Bank:</b> ${bank.bankName}</div>
                  <div style="margin-bottom: 3px;"><b>A/C No:</b> ${bank.accountNumber}</div>
                  <div style="margin-bottom: 3px;"><b>IFSC:</b> ${bank.ifscCode}</div>
                  <div style="margin-bottom: 3px;"><b>Branch:</b> ${bank.branch}</div>
                ` : '<div style="color: #999;">No bank details provided</div>'}
              </div>
              
              <div class="totals-table">
                <div class="total-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
                <div class="total-row"><span>Tax (GST)</span><span>₹${totalGST.toFixed(2)}</span></div>
                ${cdAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #d32f2f; font-weight: 500;">
                    <span>CD Deduction (${cdPercentage}%)</span>
                    <span>- ₹${cdAmount.toFixed(2)}</span>
                  </div>
                ` : ''}
                <div class="total-row grand-total">
                  <span class="grand-total-label">Grand Total</span>
                  <span class="grand-total-value">₹${sale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 60px;">
              <div class="signature-box">
                ${signatureUrl ? `<img src="${signatureUrl}" class="signature-img" />` : '<div style="height: 50px;"></div>'}
                <div class="signature-line">${businessInfo?.ownerName || 'Authorized Signatory'}</div>
                <div style="font-size: 10px; color: #888; margin-top: 4px;">Proprietor / Authorized Signatory</div>
              </div>
            </div>

            <p class="thanks">Thank you for choosing ${businessInfo?.businessName || 'us'}! This is a professional computer-generated invoice.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error("PDF generation error:", error);
      Alert.alert(t('error'), "Failed to generate PDF");
    }
  };

  const showDetails = (sale: any) => {
    setSelectedSale(sale);
    setDetailVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Title style={[styles.headerTitle, { color: theme.colors.primary }]}>{t('salesHistory')}</Title>
        <Searchbar
          placeholder={t('searchSales') || "Search name, phone or invoice..."}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}
          inputStyle={styles.searchInput}
          iconColor={theme.colors.primary}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          elevation={0}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          <FilterChip label="All Time" active={filterType === 'all'} onPress={() => setFilterType('all')} theme={theme} />
          <FilterChip label="Today" active={filterType === 'today'} onPress={() => setFilterType('today')} theme={theme} />
          <FilterChip label="This Week" active={filterType === 'week'} onPress={() => setFilterType('week')} theme={theme} />
          <FilterChip label="This Month" active={filterType === 'month'} onPress={() => setFilterType('month')} theme={theme} />
        </ScrollView>

        <Divider style={{ marginVertical: 10, opacity: 0.3 }} />
        
        <SegmentedButtons
          value={payFilter}
          onValueChange={setPayFilter}
          buttons={[
            { value: 'all', label: 'All Sales', icon: 'format-list-bulleted', checkedColor: 'white', uncheckedColor: theme.colors.onSurfaceVariant },
            { value: 'paid', label: 'Paid Only', icon: 'check-circle', checkedColor: 'white', uncheckedColor: theme.colors.onSurfaceVariant },
            { value: 'pending', label: 'Pending', icon: 'clock-alert', checkedColor: 'white', uncheckedColor: theme.colors.onSurfaceVariant },
          ]}
          style={styles.paySegmented}
          density="compact"
        />
      </Surface>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Surface style={[styles.summaryBox, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.primary }]}>Total Sales</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>₹{totalSalesAmount.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.primary }]}>Orders</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>{filteredTransactions.length}</Text>
            </View>
          </Surface>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => showDetails(item)} activeOpacity={0.7}>
            <Card style={[styles.saleCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardLeft}>
                  <Surface style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                    <IconButton icon="receipt" iconColor={theme.colors.primary} size={24} style={{ margin: 0 }} />
                  </Surface>
                  <View style={styles.textContainer}>
                    <Text 
                      style={[
                        styles.customerName, 
                        { color: isDarkMode ? '#ffffff' : theme.colors.onSurface }
                      ]} 
                      numberOfLines={1}
                    >
                      {item.customerName || 'Walk-in Customer'}
                    </Text>
                    <View style={styles.metaRow}>
                      {item.customerPhone && (
                        <View style={styles.infoRow}>
                          <IconButton icon="phone-outline" size={12} style={styles.inlineIcon} iconColor={isDarkMode ? '#e1e3e1' : theme.colors.onSurfaceVariant} />
                          <Text style={[styles.infoText, { color: isDarkMode ? '#e1e3e1' : theme.colors.onSurfaceVariant }]}>{item.customerPhone}</Text>
                        </View>
                      )}
                      <View style={styles.infoRow}>
                        <IconButton icon="calendar-outline" size={12} style={styles.inlineIcon} iconColor={isDarkMode ? '#e1e3e1' : theme.colors.onSurfaceVariant} />
                        <Text style={[styles.infoText, { color: isDarkMode ? '#e1e3e1' : theme.colors.onSurfaceVariant }]}>
                          {item.timestamp?.toDate().toLocaleDateString('en-IN', { 
                            day: '2-digit', month: 'short'
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.amountText, { color: isDarkMode ? '#ffffff' : theme.colors.primary }]}>₹{item.total.toLocaleString('en-IN')}</Text>
                  <Badge 
                    style={{ 
                      backgroundColor: item.paymentStatus === 'pending' ? theme.colors.error : theme.colors.primary, 
                      color: 'white',
                      marginBottom: 5
                    }}
                  >
                    {(item.paymentStatus || 'paid').toUpperCase()}
                  </Badge>
                  <View style={styles.viewAction}>
                    <Text style={[styles.viewText, { color: theme.colors.onSurfaceVariant }]}>VIEW</Text>
                    <IconButton icon="chevron-right" iconColor={theme.colors.onSurfaceVariant} size={16} style={{ margin: 0 }} />
                  </View>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="note-off-outline" size={80} iconColor={theme.colors.onSurfaceVariant} style={{ opacity: 0.3 }} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No sales records found</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Portal>
        <Modal visible={detailVisible} onDismiss={() => setDetailVisible(false)} contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          {selectedSale && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Title style={[styles.modalTitle, { color: theme.colors.primary }]}>Transaction Details</Title>
              <Divider style={styles.modalDivider} />
              
              <SectionTitle title="Customer Information" />
              <DetailRow label={t('name')} value={selectedSale.customerName} />
              <DetailRow label={t('phone')} value={selectedSale.customerPhone} />
              <DetailRow label="Invoice No" value={selectedSale.invoiceNumber || selectedSale.id.slice(-6).toUpperCase()} />
              
              <Divider style={styles.innerDivider} />
              <SectionTitle title="Payment Status" />
              <View style={styles.statusActionRow}>
                <Badge 
                  style={[
                    styles.statusBadge, 
                    { backgroundColor: selectedSale.paymentStatus === 'pending' ? theme.colors.error : theme.colors.primary }
                  ]}
                >
                  {(selectedSale.paymentStatus || 'paid').toUpperCase()}
                </Badge>
                <Button 
                  mode="outlined" 
                  compact 
                  onPress={() => handleTogglePayment(selectedSale.id, selectedSale.paymentStatus || 'paid')}
                  loading={updating}
                  style={styles.toggleBtn}
                >
                  Mark as {selectedSale.paymentStatus === 'pending' ? 'Paid' : 'Pending'}
                </Button>
              </View>

              <Divider style={styles.innerDivider} />
              <DetailRow label="Dispatch From" value={selectedSale.dispatchLocation} />
              <DetailRow label="Destination" value={selectedSale.destination} />
              <DetailRow label="Vehicle No" value={selectedSale.vehicleNumber} />
              
              <Divider style={styles.innerDivider} />
              <SectionTitle title="Purchased Items" />
              {selectedSale.items.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: theme.colors.onSurface }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>{item.qty} units x ₹{item.price}</Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>₹{(item.price * item.qty * (1 + item.gst/100)).toFixed(2)}</Text>
                </View>
              ))}
              
              <Divider style={styles.innerDivider} />
              <DetailRow label="Subtotal" value={`₹${(selectedSale.subtotal || selectedSale.items.reduce((acc: number, item: any) => acc + (item.price * item.qty), 0)).toFixed(2)}`} />
              <DetailRow label="Total GST" value={`₹${(selectedSale.totalGST || (selectedSale.total - (selectedSale.subtotal || 0))).toFixed(2)}`} />
              {selectedSale.cdAmount > 0 && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.error }]}>CD Deduction (${selectedSale.cdPercentage}%):</Text>
                  <Text style={[styles.detailValue, { color: theme.colors.error }]}>- ₹{selectedSale.cdAmount.toFixed(2)}</Text>
                </View>
              )}

              <Surface style={[styles.totalSurface, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                <View style={styles.finalTotalRow}>
                  <Text style={[styles.totalLabel, { color: theme.colors.primary }]}>{t('grandTotal')}</Text>
                  <Text style={[styles.totalValue, { color: theme.colors.primary }]}>₹{selectedSale.total.toFixed(2)}</Text>
                </View>
              </Surface>
              
              <View style={styles.modalActions}>
                <Button mode="contained" onPress={() => generatePDF(selectedSale)} style={styles.pdfBtn} icon="file-pdf-box" buttonColor={theme.colors.error}>
                  {t('generatePdf')}
                </Button>
                <Button mode="outlined" onPress={() => setDetailVisible(false)} style={styles.closeBtn} textColor={theme.colors.primary}>
                  {t('close')}
                </Button>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 55,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  searchBar: { borderRadius: 12, height: 46 },
  searchInput: { fontSize: 14 },
  filterScroll: { marginTop: 15 },
  filterContent: { paddingRight: 20 },
  paySegmented: { marginTop: 5, borderRadius: 12 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    elevation: 1,
  },
  chipText: { fontSize: 12, fontWeight: 'bold' },
  summaryBox: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    padding: 18,
    borderRadius: 24,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(0,0,0,0.05)' },
  listContent: { paddingBottom: 40 },
  saleCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContainer: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  inlineIcon: { margin: 0, padding: 0, width: 18 },
  infoText: { fontSize: 12 },
  cardRight: { alignItems: 'flex-end', paddingLeft: 10 },
  amountText: { fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  viewAction: { flexDirection: 'row', alignItems: 'center', opacity: 0.8 },
  viewText: { fontSize: 10, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 80, padding: 40 },
  emptyText: { fontSize: 16, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
  modalContent: { padding: 25, margin: 20, borderRadius: 30, maxHeight: '85%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', fontSize: 22, marginBottom: 10 },
  modalDivider: { marginBottom: 20, opacity: 0.5 },
  sectionSubTitle: { fontSize: 11, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { color: '#666', fontSize: 14 },
  detailValue: { fontWeight: '600', color: '#333', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 20 },
  statusActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  statusBadge: { paddingHorizontal: 12, height: 28, textAlignVertical: 'center', fontSize: 12, fontWeight: 'bold' },
  toggleBtn: { borderRadius: 10 },
  innerDivider: { marginVertical: 18, opacity: 0.2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalSurface: { marginTop: 20, padding: 20, borderRadius: 20 },
  finalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: 'bold' },
  totalValue: { fontSize: 22, fontWeight: 'bold' },
  modalActions: { marginTop: 25 },
  pdfBtn: { marginBottom: 12, borderRadius: 15, paddingVertical: 4 },
  closeBtn: { borderRadius: 15, paddingVertical: 4 }
});
